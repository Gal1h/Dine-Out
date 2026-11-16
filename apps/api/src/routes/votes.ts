import { Router } from "express";
import {
  createVoteSchema,
  submitOrderSchema,
  updateVoteSchema,
  voteStatusAt,
} from "@dineout/shared";
import { prisma } from "../db/prisma.js";
import { randomId } from "../lib/crypto.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { deleteMenuImage, saveMenuImage, uploadMenuImage } from "../lib/upload.js";
import { requireAuth, requireGroupMember, requireGroupRole } from "../middleware/auth.js";
import { getVoteAccess, serializeVote } from "../services/access.js";

const router = Router();
router.use(requireAuth);

function parseDeadline(value: string, label: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest(`${label} tidak valid`);
  return date;
}

/* -------------------------------------------------- daftar & buat voting */

router.get("/groups/:groupId/votes", requireGroupMember(), async (req, res, next) => {
  try {
    const userId = req.currentUser!.id;
    const votes = await prisma.vote.findMany({
      where: { groupId: req.params.groupId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { orders: true } },
        orders: { where: { userId }, select: { id: true } },
      },
    });

    res.json({
      votes: votes.map((v) =>
        serializeVote(v, {
          orderCount: v._count.orders,
          hasMyOrder: v.orders.length > 0,
        }),
      ),
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/groups/:groupId/votes",
  requireGroupMember(),
  requireGroupRole("admin", "mod"),
  uploadMenuImage.single("menuImage"),
  async (req, res, next) => {
    let savedImage: string | null = null;
    try {
      const input = createVoteSchema.parse(req.body);
      const menuText = input.menuText?.trim() || null;
      if (!menuText && !req.file) {
        throw badRequest("Isi teks menu atau unggah screenshot menu");
      }

      const voteDeadline = parseDeadline(input.voteDeadline, "Batas voting");
      const orderDeadline = parseDeadline(input.orderDeadline, "Batas isi form");
      const now = new Date();
      if (voteDeadline <= now) throw badRequest("Batas voting harus setelah waktu sekarang");
      if (orderDeadline <= voteDeadline) {
        throw badRequest("Batas isi form harus setelah batas voting");
      }

      if (req.file) savedImage = await saveMenuImage(req.file.buffer);

      const vote = await prisma.vote.create({
        data: {
          id: randomId(),
          groupId: req.params.groupId,
          storeName: input.storeName,
          mapsUrl: input.mapsUrl,
          menuText,
          menuImagePath: savedImage,
          voteDeadline,
          orderDeadline,
          createdBy: req.currentUser!.id,
        },
      });

      res.status(201).json({ vote: serializeVote(vote) });
    } catch (err) {
      if (savedImage) await deleteMenuImage(savedImage);
      next(err);
    }
  },
);

router.get("/votes/:id", async (req, res, next) => {
  try {
    const { vote, role } = await getVoteAccess(req.currentUser!.id, req.params.id);
    const orderCount = await prisma.voteOrder.count({ where: { voteId: vote.id } });
    const mine = await prisma.voteOrder.findUnique({
      where: { voteId_userId: { voteId: vote.id, userId: req.currentUser!.id } },
      select: { id: true },
    });
    res.json({
      vote: serializeVote(vote, { orderCount, hasMyOrder: Boolean(mine) }),
      role,
    });
  } catch (err) {
    next(err);
  }
});

router.patch("/votes/:id", uploadMenuImage.single("menuImage"), async (req, res, next) => {
  let savedImage: string | null = null;
  let oldImage: string | null = null;
  try {
    const user = req.currentUser!;
    const { vote, role } = await getVoteAccess(user.id, req.params.id);
    if (role !== "admin" && role !== "mod") {
      throw forbidden("Role Anda tidak diizinkan untuk aksi ini");
    }
    if (new Date() >= vote.voteDeadline) {
      throw badRequest("Batas voting sudah lewat, voting tidak bisa diedit");
    }

    if (typeof req.body.removeMenuImage === "string") {
      req.body.removeMenuImage = req.body.removeMenuImage === "true";
    }
    const input = updateVoteSchema.parse(req.body);

    const voteDeadline = input.voteDeadline
      ? parseDeadline(input.voteDeadline, "Batas voting")
      : vote.voteDeadline;
    const orderDeadline = input.orderDeadline
      ? parseDeadline(input.orderDeadline, "Batas isi form")
      : vote.orderDeadline;
    if (orderDeadline <= voteDeadline) {
      throw badRequest("Batas isi form harus setelah batas voting");
    }
    if (input.voteDeadline && voteDeadline <= new Date()) {
      throw badRequest("Batas voting baru harus setelah waktu sekarang");
    }

    const menuText =
      input.menuText === undefined ? vote.menuText : input.menuText.trim() || null;
    let menuImagePath = vote.menuImagePath;
    if (input.removeMenuImage) {
      oldImage = menuImagePath;
      menuImagePath = null;
    }
    if (req.file) {
      savedImage = await saveMenuImage(req.file.buffer);
      oldImage = menuImagePath;
      menuImagePath = savedImage;
    }
    if (!menuText && !menuImagePath) {
      throw badRequest("Isi teks menu atau unggah screenshot menu");
    }

    const updated = await prisma.vote.update({
      where: { id: vote.id },
      data: {
        storeName: input.storeName ?? vote.storeName,
        mapsUrl: input.mapsUrl ?? vote.mapsUrl,
        menuText,
        menuImagePath,
        voteDeadline,
        orderDeadline,
        updatedBy: user.id,
      },
    });

    if (oldImage && oldImage !== menuImagePath) await deleteMenuImage(oldImage);
    res.json({ vote: serializeVote(updated) });
  } catch (err) {
    if (savedImage) await deleteMenuImage(savedImage);
    next(err);
  }
});

/* --------------------------------------------------------- form pesanan */

router.get("/votes/:id/orders/me", async (req, res, next) => {
  try {
    const userId = req.currentUser!.id;
    const { vote } = await getVoteAccess(userId, req.params.id);
    const order = await prisma.voteOrder.findUnique({
      where: { voteId_userId: { voteId: vote.id, userId } },
      include: { items: true },
    });
    res.json({
      vote: serializeVote(vote),
      order: order
        ? {
            id: order.id,
            submittedAt: order.submittedAt.toISOString(),
            updatedAt: order.updatedAt.toISOString(),
            items: order.items.map((i) => ({
              id: i.id,
              itemType: i.itemType,
              name: i.name,
              qty: i.qty,
              note: i.note,
            })),
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

router.put("/votes/:id/orders/me", async (req, res, next) => {
  try {
    const userId = req.currentUser!.id;
    const { vote, role } = await getVoteAccess(userId, req.params.id);
    if (role !== "admin" && role !== "mod" && role !== "member") {
      throw forbidden();
    }
    const status = voteStatusAt(new Date(), vote.voteDeadline, vote.orderDeadline);
    if (status === "open") {
      throw badRequest("Form pesanan dibuka setelah batas voting lewat");
    }
    if (status === "closed") {
      throw badRequest("Batas isi form sudah lewat");
    }

    const input = submitOrderSchema.parse(req.body);
    const normalized = input.items.map((item) => ({
      itemType: item.itemType,
      name: item.name,
      qty: item.qty,
      note: item.note?.trim() || null,
    }));

    const order = await prisma.$transaction(async (tx) => {
      const existing = await tx.voteOrder.findUnique({
        where: { voteId_userId: { voteId: vote.id, userId } },
      });
      const orderId = existing?.id ?? randomId();
      if (existing) {
        await tx.voteOrderItem.deleteMany({ where: { orderId } });
        await tx.voteOrder.update({
          where: { id: orderId },
          data: { updatedAt: new Date() },
        });
      } else {
        await tx.voteOrder.create({
          data: { id: orderId, voteId: vote.id, userId },
        });
      }
      await tx.voteOrderItem.createMany({
        data: normalized.map((item) => ({
          id: randomId(),
          orderId,
          itemType: item.itemType,
          name: item.name,
          qty: item.qty,
          note: item.note,
        })),
      });
      return tx.voteOrder.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true },
      });
    });

    res.json({
      order: {
        id: order.id,
        submittedAt: order.submittedAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        items: order.items.map((i) => ({
          id: i.id,
          itemType: i.itemType,
          name: i.name,
          qty: i.qty,
          note: i.note,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/votes/:id/orders", async (req, res, next) => {
  try {
    const userId = req.currentUser!.id;
    const { vote, role } = await getVoteAccess(userId, req.params.id);
    if (role !== "admin" && role !== "mod") {
      throw forbidden("Hanya admin dan mod yang bisa melihat rekap pesanan");
    }

    const members = await prisma.groupMember.findMany({
      where: { groupId: vote.groupId },
      include: { user: { select: { id: true, displayName: true } } },
    });
    const orders = await prisma.voteOrder.findMany({
      where: { voteId: vote.id },
      include: {
        user: { select: { id: true, displayName: true } },
        items: true,
      },
      orderBy: { submittedAt: "asc" },
    });

    const ordererIds = new Set(orders.map((o) => o.userId));
    const notOrdered = members
      .filter((m) => !ordererIds.has(m.userId))
      .map((m) => ({
        userId: m.userId,
        displayName: m.user.displayName,
        username: m.username,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    const foodItems = orders.reduce(
      (sum, o) => sum + o.items.filter((i) => i.itemType === "food").length,
      0,
    );
    const drinkItems = orders.reduce(
      (sum, o) => sum + o.items.filter((i) => i.itemType === "drink").length,
      0,
    );

    res.json({
      vote: serializeVote(vote, { orderCount: orders.length }),
      orders: orders.map((o) => ({
        id: o.id,
        userId: o.userId,
        displayName: o.user.displayName,
        username: members.find((m) => m.userId === o.userId)?.username ?? null,
        submittedAt: o.submittedAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
        items: o.items.map((i) => ({
          id: i.id,
          itemType: i.itemType,
          name: i.name,
          qty: i.qty,
          note: i.note,
        })),
      })),
      notOrdered,
      totals: { foodItems, drinkItems, people: orders.length },
    });
  } catch (err) {
    next(err);
  }
});

export { router as votesRouter };
