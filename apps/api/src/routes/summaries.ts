import { Router } from "express";
import {
  saveAiSummarySchema,
  saveManualSummarySchema,
  type ItemType,
} from "@dineout/shared";
import { prisma } from "../db/prisma.js";
import { randomId } from "../lib/crypto.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { openSecret } from "../lib/crypto.js";
import { logger } from "../lib/logger.js";
import { requireAuth } from "../middleware/auth.js";
import { getVoteAccess } from "../services/access.js";
import { sortOrdersWithGemini } from "../services/gemini.js";

const router = Router();
router.use(requireAuth);

type SummaryRow = {
  id: string;
  voteId: string;
  source: "manual" | "gemini";
  createdAt: Date;
  createdBy: string;
  maker?: { displayName: string } | null;
  items: Array<{ id: string; itemType: ItemType; name: string; totalQty: number }>;
};

function serializeSummary(summary: SummaryRow) {
  return {
    id: summary.id,
    voteId: summary.voteId,
    source: summary.source,
    createdAt: summary.createdAt.toISOString(),
    createdBy: summary.createdBy,
    createdByName: summary.maker?.displayName,
    items: summary.items
      .map((i) => ({ id: i.id, itemType: i.itemType, name: i.name, totalQty: i.totalQty }))
      .sort((a, b) => a.itemType.localeCompare(b.itemType) || a.name.localeCompare(b.name)),
  };
}

router.get("/votes/:id/summaries", async (req, res, next) => {
  try {
    const { vote, role } = await getVoteAccess(req.currentUser!.id, req.params.id);
    if (role !== "admin" && role !== "mod") throw forbidden();

    const summaries = await prisma.orderSummary.findMany({
      where: { voteId: vote.id },
      orderBy: { createdAt: "desc" },
      include: { items: true, maker: { select: { displayName: true } } },
    });
    res.json({ summaries: summaries.map(serializeSummary) });
  } catch (err) {
    next(err);
  }
});

async function saveSummary(
  voteId: string,
  userId: string,
  source: "manual" | "gemini",
  items: Array<{ itemType: ItemType; name: string; totalQty: number }>,
) {
  const summary = await prisma.$transaction(async (tx) => {
    const created = await tx.orderSummary.create({
      data: {
        id: randomId(),
        voteId,
        source,
        createdBy: userId,
        items: {
          create: items.map((i) => ({
            id: randomId(),
            itemType: i.itemType,
            name: i.name,
            totalQty: i.totalQty,
          })),
        },
      },
      include: { items: true, maker: { select: { displayName: true } } },
    });
    return created;
  });
  return summary;
}

router.post("/votes/:id/summaries/manual", async (req, res, next) => {
  try {
    const user = req.currentUser!;
    const { vote, role } = await getVoteAccess(user.id, req.params.id);
    if (role !== "admin" && role !== "mod") throw forbidden();
    if (new Date() < vote.voteDeadline) {
      throw badRequest("Voting masih berjalan. Rekap dibuat setelah batas voting lewat.");
    }
    const input = saveManualSummarySchema.parse(req.body);
    const summary = await saveSummary(vote.id, user.id, "manual", input.items);
    res.status(201).json({ summary: serializeSummary(summary) });
  } catch (err) {
    next(err);
  }
});

router.post("/votes/:id/summaries/ai", async (req, res, next) => {
  try {
    const user = req.currentUser!;
    const { vote, role } = await getVoteAccess(user.id, req.params.id);
    if (role !== "admin") throw forbidden("Hanya admin yang bisa memakai sortir AI");
    if (!user.geminiKeyEncrypted || !user.geminiKeyIv || !user.geminiKeyTag) {
      throw badRequest("Gemini API key belum diisi. Buka Pengaturan untuk mengisinya.");
    }

    const orders = await prisma.voteOrder.findMany({
      where: { voteId: vote.id },
      include: {
        user: { select: { displayName: true } },
        items: true,
      },
    });
    if (orders.length === 0) throw badRequest("Belum ada pesanan untuk direkap");

    const apiKey = openSecret({
      ciphertext: user.geminiKeyEncrypted,
      iv: user.geminiKeyIv,
      tag: user.geminiKeyTag,
    });

    const result = await sortOrdersWithGemini(
      apiKey,
      orders.map((o) => ({
        displayName: o.user.displayName,
        items: o.items.map((i) => ({
          itemType: i.itemType,
          name: i.name,
          qty: i.qty,
          note: i.note,
        })),
      })),
    );

    logger.info({ voteId: vote.id, model: result.model }, "sortir AI selesai");
    res.json({ items: result.items, aiRaw: result.aiRaw, model: result.model });
  } catch (err) {
    next(err);
  }
});

router.post("/votes/:id/summaries/ai/save", async (req, res, next) => {
  try {
    const user = req.currentUser!;
    const { vote, role } = await getVoteAccess(user.id, req.params.id);
    if (role !== "admin") throw forbidden("Hanya admin yang bisa menyimpan hasil AI");

    const input = saveAiSummarySchema.parse(req.body);
    const summary = await saveSummary(vote.id, user.id, "gemini", input.items);
    res.status(201).json({ summary: serializeSummary(summary) });
  } catch (err) {
    next(err);
  }
});

router.get("/summaries/:id", async (req, res, next) => {
  try {
    const summary = await prisma.orderSummary.findUnique({
      where: { id: req.params.id },
      include: { items: true, maker: { select: { displayName: true } }, vote: true },
    });
    if (!summary) throw notFound("Rekap tidak ditemukan");
    const { role } = await getVoteAccess(req.currentUser!.id, summary.voteId);
    if (role !== "admin" && role !== "mod") throw forbidden();
    res.json({ summary: serializeSummary(summary), voteId: summary.voteId });
  } catch (err) {
    next(err);
  }
});

export { router as summariesRouter };
