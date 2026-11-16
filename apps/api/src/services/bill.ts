import { calculateBillLine, normalizeItemName, type ItemType } from "@dineout/shared";

export interface PriceEntry {
  itemType: ItemType;
  name: string;
  price: number;
}

export interface SubsidyEntry {
  userId: string;
  foodSubsidy: number;
  drinkSubsidy: number;
}

export interface BillOrderInput {
  userId: string;
  items: Array<{ itemType: ItemType; name: string; qty: number }>;
}

export interface BillUserRow {
  userId: string;
  foodTotal: number;
  drinkTotal: number;
  foodSubsidy: number;
  drinkSubsidy: number;
  foodPayable: number;
  drinkPayable: number;
  payable: number;
}

export interface BillComputation {
  rows: BillUserRow[];
  warnings: Array<{ userId?: string; message: string }>;
}

interface IndexedPrice extends PriceEntry {
  normalized: string;
  tokens: string[];
}

const STOP_WORDS = new Set(["dan", "with", "tanpa", "extra", "pakai", "the", "a", "an"]);

function tokenize(value: string): string[] {
  return normalizeItemName(value)
    .split(/[^a-z0-9]+/g)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function buildIndex(prices: PriceEntry[]): Map<string, IndexedPrice[]> {
  const index = new Map<string, IndexedPrice[]>();
  for (const price of prices) {
    const entry: IndexedPrice = {
      ...price,
      normalized: normalizeItemName(price.name),
      tokens: tokenize(price.name),
    };
    const list = index.get(price.itemType) ?? [];
    list.push(entry);
    index.set(price.itemType, list);
  }
  return index;
}

function overlapScore(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  let shared = 0;
  for (const token of a) if (setB.has(token)) shared += 1;
  return shared / Math.max(a.length, b.length);
}

export function matchPrice(
  index: Map<string, IndexedPrice[]>,
  itemType: ItemType,
  name: string,
): IndexedPrice | null {
  const candidates = index.get(itemType) ?? [];
  if (!candidates.length) return null;

  const normalized = normalizeItemName(name);
  const exact = candidates.find((c) => c.normalized === normalized);
  if (exact) return exact;

  const contains = candidates
    .filter(
      (c) =>
        normalized.includes(c.normalized) ||
        c.normalized.includes(normalized),
    )
    .sort((a, b) => b.normalized.length - a.normalized.length)[0];
  if (contains) return contains;

  const tokens = tokenize(name);
  let best: { candidate: IndexedPrice; score: number } | null = null;
  for (const candidate of candidates) {
    const score = overlapScore(tokens, candidate.tokens);
    if (!best || score > best.score) best = { candidate, score };
  }
  if (best && best.score >= 0.5) return best.candidate;
  return null;
}

/**
 * Hitung total per user dari pesanan mentah dan daftar harga.
 * Item yang tidak punya harga dihitung 0 dan dilaporkan sebagai warning.
 */
export function computeBill(
  orders: BillOrderInput[],
  prices: PriceEntry[],
  subsidies: SubsidyEntry[],
): BillComputation {
  const index = buildIndex(prices);
  const subsidyMap = new Map(subsidies.map((s) => [s.userId, s]));
  const warnings: BillComputation["warnings"] = [];

  const unmatched = new Map<string, { name: string; itemType: ItemType }>();

  const rows: BillUserRow[] = orders.map((order) => {
    let foodTotal = 0;
    let drinkTotal = 0;

    for (const item of order.items) {
      const price = matchPrice(index, item.itemType, item.name);
      if (!price) {
        unmatched.set(`${item.itemType}|${normalizeItemName(item.name)}`, {
          name: item.name,
          itemType: item.itemType,
        });
        continue;
      }
      const lineTotal = price.price * item.qty;
      if (item.itemType === "food") foodTotal += lineTotal;
      else drinkTotal += lineTotal;
    }

    const subsidy = subsidyMap.get(order.userId);
    const line = calculateBillLine(
      foodTotal,
      drinkTotal,
      subsidy?.foodSubsidy ?? 0,
      subsidy?.drinkSubsidy ?? 0,
    );

    if (subsidy && subsidy.foodSubsidy > foodTotal) {
      warnings.push({
        userId: order.userId,
        message: `Subsidi makanan melebihi total makanan; sisa Rp${
          subsidy.foodSubsidy - foodTotal
        } hangus.`,
      });
    }
    if (subsidy && subsidy.drinkSubsidy > drinkTotal) {
      warnings.push({
        userId: order.userId,
        message: `Subsidi minuman melebihi total minuman; sisa Rp${
          subsidy.drinkSubsidy - drinkTotal
        } hangus.`,
      });
    }

    return { userId: order.userId, ...line };
  });

  for (const item of unmatched.values()) {
    warnings.push({
      message: `Harga untuk "${item.name}" (${
        item.itemType === "food" ? "makanan" : "minuman"
      }) belum diisi, item dihitung Rp0.`,
    });
  }

  const ordererIds = new Set(orders.map((o) => o.userId));
  for (const subsidy of subsidies) {
    if (!ordererIds.has(subsidy.userId) && (subsidy.foodSubsidy > 0 || subsidy.drinkSubsidy > 0)) {
      warnings.push({
        userId: subsidy.userId,
        message: "Subsidi diisi untuk anggota yang tidak punya pesanan, subsidi diabaikan.",
      });
    }
  }

  return { rows, warnings };
}
