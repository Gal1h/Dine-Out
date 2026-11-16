import { Router } from "express";
import { createBillSchema, formatRupiah } from "@dineout/shared";
import { prisma } from "../db/prisma.js";
import { randomId } from "../lib/crypto.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { assertGroupRole, getVoteAccess } from "../services/access.js";
import { computeBill } from "../services/bill.js";

const router = Router();
router.use(requireAuth);

const num = (v: bigint | number) => Number(v);

type BillWithRelations = {
  id: string;
  voteId: string;
  summaryId: string;
  createdBy: string;
  createdAt: Date;
  vote: { storeName: string; groupId: string };
  prices: Array<{ id: string; itemType: "food" | "drink"; name: string; price: bigint }>;
  totals: Array<{
    userId: string;
    foodTotal: bigint;
    drinkTotal: bigint;
    foodSubsidy: bigint;
    drinkSubsidy: bigint;
    foodPayable: bigint;
    drinkPayable: bigint;
    payable: bigint;
  }>;
};

async function serializeBill(bill: BillWithRelations) {
  const members = await prisma.groupMember.findMany({
    where: { groupId: bill.vote.groupId, userId: { in: bill.totals.map((t) => t.userId) } },
    include: { user: { select: { displayName: true } } },
  });
  const memberMap = new Map(members.map((m) => [m.userId, m]));

  const rawUsers = bill.totals
    .map((t) => {
      const member = memberMap.get(t.userId);
      return {
        userId: t.userId,
        displayName: member?.user.displayName ?? "(anggota dihapus)",
        username: member?.username ?? null,
        foodTotal: num(t.foodTotal),
        drinkTotal: num(t.drinkTotal),
        foodSubsidy: num(t.foodSubsidy),
        drinkSubsidy: num(t.drinkSubsidy),
        foodPayable: num(t.foodPayable),
        drinkPayable: num(t.drinkPayable),
        payable: num(t.payable),
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const warnings: Array<{ userId?: string; message: string }> = [];
  for (const user of rawUsers) {
    if (user.foodSubsidy > user.foodTotal) {
      warnings.push({
        userId: user.userId,
        message: `${user.displayName}: subsidi makanan melebihi total makanan, sisa ${formatRupiah(
          user.foodSubsidy - user.foodTotal,
        )} hangus.`,
      });
    }
    if (user.drinkSubsidy > user.drinkTotal) {
      warnings.push({
        userId: user.userId,
        message: `${user.displayName}: subsidi minuman melebihi total minuman, sisa ${formatRupiah(
          user.drinkSubsidy - user.drinkTotal,
        )} hangus.`,
      });
    }
  }

  // Subsidi yang ditampilkan hanya yang terpakai, supaya kolom di tagihan tetap
  // menjumlah. Sisa subsidi yang hangus tetap dijelaskan lewat warnings.
  const users = rawUsers.map((user) => ({
    ...user,
    foodSubsidy: Math.min(user.foodSubsidy, user.foodTotal),
    drinkSubsidy: Math.min(user.drinkSubsidy, user.drinkTotal),
  }));

  return {
    id: bill.id,
    voteId: bill.voteId,
    summaryId: bill.summaryId,
    storeName: bill.vote.storeName,
    createdAt: bill.createdAt.toISOString(),
    createdBy: bill.createdBy,
    prices: bill.prices.map((p) => ({
      id: p.id,
      itemType: p.itemType,
      name: p.name,
      price: num(p.price),
    })),
    users,
    totals: {
      food: users.reduce((s, u) => s + u.foodTotal, 0),
      drink: users.reduce((s, u) => s + u.drinkTotal, 0),
      payable: users.reduce((s, u) => s + u.payable, 0),
      subsidy: users.reduce((s, u) => s + u.foodSubsidy + u.drinkSubsidy, 0),
    },
    warnings,
  };
}

router.post("/summaries/:id/bills", async (req, res, next) => {
  try {
    const user = req.currentUser!;
    const input = createBillSchema.parse(req.body);

    const summary = await prisma.orderSummary.findUnique({
      where: { id: req.params.id },
      include: { vote: true, items: true },
    });
    if (!summary) throw notFound("Rekap tidak ditemukan");
    await assertGroupRole(user.id, summary.vote.groupId, ["admin"]);

    const members = await prisma.groupMember.findMany({
      where: { groupId: summary.vote.groupId },
      select: { userId: true },
    });
    const memberIds = new Set(members.map((m) => m.userId));
    for (const subsidy of input.subsidies) {
      if (!memberIds.has(subsidy.userId)) {
        throw badRequest("Subsidi diberikan ke anggota yang bukan bagian dari grup ini");
      }
    }

    const orders = await prisma.voteOrder.findMany({
      where: { voteId: summary.voteId },
      include: { items: true },
    });
    if (orders.length === 0) throw badRequest("Belum ada pesanan untuk ditagihkan");

    const computation = computeBill(
      orders.map((o) => ({
        userId: o.userId,
        items: o.items.map((i) => ({ itemType: i.itemType, name: i.name, qty: i.qty })),
      })),
      input.prices,
      input.subsidies,
    );

    if (computation.rows.length === 0) {
      throw badRequest("Tidak ada pesanan yang bisa dihitung");
    }

    const billId = randomId();
    await prisma.$transaction(async (tx) => {
      await tx.bill.create({
        data: {
          id: billId,
          voteId: summary.voteId,
          summaryId: summary.id,
          createdBy: user.id,
        },
      });
      await tx.billPrice.createMany({
        data: input.prices.map((p) => ({
          id: randomId(),
          billId,
          itemType: p.itemType,
          name: p.name,
          price: BigInt(p.price),
        })),
      });
      await tx.billUserTotal.createMany({
        data: computation.rows.map((row) => ({
          id: randomId(),
          billId,
          userId: row.userId,
          foodTotal: BigInt(row.foodTotal),
          drinkTotal: BigInt(row.drinkTotal),
          foodSubsidy: BigInt(row.foodSubsidy),
          drinkSubsidy: BigInt(row.drinkSubsidy),
          foodPayable: BigInt(row.foodPayable),
          drinkPayable: BigInt(row.drinkPayable),
          payable: BigInt(row.payable),
        })),
      });
    });

    const bill = await prisma.bill.findUniqueOrThrow({
      where: { id: billId },
      include: {
        vote: { select: { storeName: true, groupId: true } },
        prices: true,
        totals: true,
      },
    });

    res.status(201).json({
      bill: { ...(await serializeBill(bill)), warnings: computation.warnings },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/bills/:id", async (req, res, next) => {
  try {
    const bill = await prisma.bill.findUnique({
      where: { id: req.params.id },
      include: {
        vote: { select: { storeName: true, groupId: true } },
        prices: true,
        totals: true,
      },
    });
    if (!bill) throw notFound("Tagihan tidak ditemukan");
    await assertGroupRole(req.currentUser!.id, bill.vote.groupId, ["admin"]);
    res.json({ bill: await serializeBill(bill) });
  } catch (err) {
    next(err);
  }
});

router.get("/votes/:id/bills", async (req, res, next) => {
  try {
    const { vote, role } = await getVoteAccess(req.currentUser!.id, req.params.id);
    if (role !== "admin" && role !== "mod") throw forbidden();
    const bills = await prisma.bill.findMany({
      where: { voteId: vote.id },
      orderBy: { createdAt: "desc" },
      include: { prices: true, totals: true },
      take: 50,
    });
    res.json({
      bills: bills.map((b) => ({
        id: b.id,
        voteId: b.voteId,
        summaryId: b.summaryId,
        createdAt: b.createdAt.toISOString(),
        createdBy: b.createdBy,
        totalUsers: b.totals.length,
        totalPayable: b.totals.reduce((sum, t) => sum + num(t.payable), 0),
      })),
    });
  } catch (err) {
    next(err);
  }
});

export { router as billsRouter };
