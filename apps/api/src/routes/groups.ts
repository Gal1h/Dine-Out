import { Router } from "express";
import bcrypt from "bcryptjs";
import {
  bulkMembersSchema,
  createGroupSchema,
  memberRoleSchema,
  resetMemberPasswordSchema,
  uuidSchema,
} from "@dineout/shared";
import { prisma } from "../db/prisma.js";
import { randomId } from "../lib/crypto.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import {
  requireAdminAccount,
  requireAuth,
  requireGroupMember,
  requireGroupRole,
} from "../middleware/auth.js";

const router = Router();

/** Publik: daftar grup untuk pilihan saat member login. */
router.get("/public", async (_req, res, next) => {
  try {
    const groups = await prisma.group.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    });
    res.json({ groups });
  } catch (err) {
    next(err);
  }
});

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const userId = req.currentUser!.id;
    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: { _count: { select: { members: true } } },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    const ids = memberships.map((m) => m.groupId);
    const activeCounts = ids.length
      ? await prisma.vote.groupBy({
          by: ["groupId"],
          where: { groupId: { in: ids }, orderDeadline: { gt: new Date() } },
          _count: { _all: true },
        })
      : [];
    const activeMap = new Map(activeCounts.map((c) => [c.groupId, c._count._all]));

    res.json({
      groups: memberships.map((m) => ({
        id: m.group.id,
        name: m.group.name,
        adminId: m.group.adminId,
        createdAt: m.group.createdAt.toISOString(),
        role: m.role,
        memberCount: m.group._count.members,
        activeVoteCount: activeMap.get(m.groupId) ?? 0,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAdminAccount, async (req, res, next) => {
  try {
    const input = createGroupSchema.parse(req.body);
    const admin = req.currentUser!;

    const group = await prisma.group.create({
      data: {
        id: randomId(),
        name: input.name,
        adminId: admin.id,
        members: {
          create: { userId: admin.id, role: "admin" },
        },
      },
    });

    res.status(201).json({
      group: {
        id: group.id,
        name: group.name,
        adminId: group.adminId,
        createdAt: group.createdAt.toISOString(),
        role: "admin",
        memberCount: 1,
        activeVoteCount: 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:groupId", requireGroupMember(), async (req, res, next) => {
  try {
    const group = await prisma.group.findUnique({
      where: { id: req.params.groupId },
      include: { _count: { select: { members: true, votes: true } } },
    });
    if (!group) throw notFound("Grup tidak ditemukan");
    res.json({
      group: {
        id: group.id,
        name: group.name,
        adminId: group.adminId,
        createdAt: group.createdAt.toISOString(),
        timezone: group.timezone,
        role: req.membership!.role,
        memberCount: group._count.members,
        voteCount: group._count.votes,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:groupId/members", requireGroupMember(), async (req, res, next) => {
  try {
    const isAdmin = req.membership!.role === "admin";
    const members = await prisma.groupMember.findMany({
      where: { groupId: req.params.groupId },
      include: {
        user: {
          select: { id: true, displayName: true, email: true, accountType: true },
        },
      },
    });

    const order = { admin: 0, mod: 1, member: 2 } as const;
    members.sort((a, b) => {
      const roleDiff = order[a.role] - order[b.role];
      if (roleDiff !== 0) return roleDiff;
      return a.user.displayName.localeCompare(b.user.displayName);
    });

    res.json({
      members: members.map((m) => ({
        userId: m.userId,
        displayName: m.user.displayName,
        username: m.username,
        email: isAdmin ? m.user.email : null,
        accountType: m.user.accountType,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/:groupId/members/bulk",
  requireGroupMember(),
  requireGroupRole("admin"),
  async (req, res, next) => {
    try {
      const input = bulkMembersSchema.parse(req.body);
      const groupId = req.params.groupId;

      const usernames = input.members.map((m) => m.username);
      const uniqueCheck = new Set(usernames);
      if (uniqueCheck.size !== usernames.length) {
        throw badRequest("Ada username yang sama dalam daftar");
      }

      const existing = await prisma.groupMember.findMany({
        where: { groupId, username: { in: usernames } },
        select: { username: true },
      });
      if (existing.length > 0) {
        throw conflict(`Username sudah dipakai: ${existing.map((e) => e.username).join(", ")}`);
      }

      const hashes = await Promise.all(input.members.map((m) => bcrypt.hash(m.password, 12)));

      const created = await prisma.$transaction(
        input.members.map((m, i) =>
          prisma.user.create({
            data: {
              id: randomId(),
              accountType: "member",
              passwordHash: hashes[i],
              displayName: m.displayName,
              memberships: {
                create: { groupId, role: "member", username: m.username },
              },
            },
            select: { id: true, displayName: true },
          }),
        ),
      );

      res.status(201).json({
        created: created.map((c, i) => ({
          userId: c.id,
          displayName: c.displayName,
          username: input.members[i].username,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/:groupId/members/:userId/role",
  requireGroupMember(),
  requireGroupRole("admin"),
  async (req, res, next) => {
    try {
      const userId = uuidSchema.parse(req.params.userId);
      const input = memberRoleSchema.parse(req.body);
      const member = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: req.params.groupId, userId } },
      });
      if (!member) throw notFound("Anggota tidak ditemukan");
      if (member.role === "admin") throw badRequest("Role admin tidak bisa diubah");

      const updated = await prisma.groupMember.update({
        where: { groupId_userId: { groupId: req.params.groupId, userId } },
        data: { role: input.role },
      });
      res.json({ member: { userId, role: updated.role } });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/:groupId/members/:userId/password",
  requireGroupMember(),
  requireGroupRole("admin"),
  async (req, res, next) => {
    try {
      const userId = uuidSchema.parse(req.params.userId);
      const input = resetMemberPasswordSchema.parse(req.body);
      const member = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: req.params.groupId, userId } },
        include: { user: { select: { accountType: true } } },
      });
      if (!member) throw notFound("Anggota tidak ditemukan");
      if (member.user.accountType !== "member") {
        throw badRequest("Password akun admin hanya bisa diubah sendiri lewat Profil");
      }

      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await bcrypt.hash(input.newPassword, 12) },
      });
      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

export { router as groupsRouter };
