import {
  geminiSummaryResponseSchema,
  normalizeItemName,
  type ItemType,
} from "@dineout/shared";
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";
import { upstream } from "../lib/errors.js";

export interface GeminiOrderInput {
  displayName: string;
  items: Array<{ itemType: ItemType; name: string; qty: number; note: string | null }>;
}

export interface GeminiSortResult {
  items: Array<{ itemType: ItemType; name: string; totalQty: number }>;
  aiRaw: string;
  model: string;
}

function buildPrompt(orders: GeminiOrderInput[]): string {
  const lines: string[] = [];
  for (const order of orders) {
    lines.push(`## ${order.displayName}`);
    const food = order.items.filter((i) => i.itemType === "food");
    const drink = order.items.filter((i) => i.itemType === "drink");
    if (food.length) {
      lines.push("Makanan:");
      for (const item of food) {
        lines.push(`- ${item.name} x${item.qty}${item.note ? ` (catatan: ${item.note})` : ""}`);
      }
    }
    if (drink.length) {
      lines.push("Minuman:");
      for (const item of drink) {
        lines.push(`- ${item.name} x${item.qty}${item.note ? ` (catatan: ${item.note})` : ""}`);
      }
    }
  }

  return [
    "Kamu membantu admin restoran merekap pesanan grup.",
    "Gabungkan item yang sama atau hampir sama (beda huruf besar/kecil, singkatan, atau ejaan kecil) menjadi satu baris.",
    "Jangan mengarang item baru. Jumlahkan qty untuk nama item yang digabung.",
    "Pisahkan makanan (food) dan minuman (drink) sesuai data.",
    "Gunakan nama item yang paling jelas dan singkat dalam bahasa aslinya.",
    'Balas HANYA dengan JSON: {"foodTotals":[{"name":"...","totalQty":1}],"drinkTotals":[{"name":"...","totalQty":1}]}',
    "",
    "Data pesanan:",
    ...lines,
  ].join("\n");
}

const responseSchema = {
  type: "OBJECT",
  properties: {
    foodTotals: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          totalQty: { type: "INTEGER" },
        },
        required: ["name", "totalQty"],
      },
    },
    drinkTotals: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          totalQty: { type: "INTEGER" },
        },
        required: ["name", "totalQty"],
      },
    },
  },
  required: ["foodTotals", "drinkTotals"],
};

interface GeminiApiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    env.GEMINI_MODEL,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema,
        },
      }),
    });
  } catch (err) {
    logger.warn({ err }, "gagal menghubungi Gemini");
    throw upstream("Tidak bisa menghubungi layanan Gemini. Periksa koneksi server.");
  }

  if (response.status === 400 || response.status === 403) {
    throw upstream("API key Gemini tidak valid atau tidak punya akses ke model ini.");
  }
  if (response.status === 429) {
    throw upstream("Kuota Gemini habis. Coba lagi nanti atau sortir manual.");
  }
  if (!response.ok) {
    throw upstream("Gemini sedang tidak bisa dipakai. Coba lagi atau sortir manual.");
  }

  const data = (await response.json()) as GeminiApiResponse;
  if (data.promptFeedback?.blockReason) {
    throw upstream("Permintaan diblokir oleh filter Gemini. Sortir manual saja.");
  }
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) {
    throw upstream("Gemini tidak mengembalikan hasil. Coba lagi atau sortir manual.");
  }
  return text;
}

function parseStructured(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  const result = geminiSummaryResponseSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

export async function sortOrdersWithGemini(
  apiKey: string,
  orders: GeminiOrderInput[],
): Promise<GeminiSortResult> {
  const basePrompt = buildPrompt(orders);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt =
      attempt === 0
        ? basePrompt
        : `${basePrompt}\n\nPENTING: balasan sebelumnya tidak valid. Balas hanya JSON valid tanpa penjelasan.`;
    const raw = await callGemini(apiKey, prompt);
    const parsed = parseStructured(raw);
    if (!parsed) continue;

    const items = [
      ...parsed.foodTotals.map((i) => ({
        itemType: "food" as const,
        name: i.name,
        totalQty: i.totalQty,
      })),
      ...parsed.drinkTotals.map((i) => ({
        itemType: "drink" as const,
        name: i.name,
        totalQty: i.totalQty,
      })),
    ];

    // Gabungkan duplikat yang mungkin dihasilkan model.
    const merged = new Map<string, { itemType: ItemType; name: string; totalQty: number }>();
    for (const item of items) {
      const key = `${item.itemType}|${normalizeItemName(item.name)}`;
      const found = merged.get(key);
      if (found) found.totalQty += item.totalQty;
      else merged.set(key, { ...item });
    }

    return { items: [...merged.values()], aiRaw: raw, model: env.GEMINI_MODEL };
  }

  throw upstream("Hasil Gemini tidak valid. Coba lagi atau sortir manual.");
}
