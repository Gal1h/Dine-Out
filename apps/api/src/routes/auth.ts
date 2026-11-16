import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import {
  changePasswordSchema,
  loginAdminSchema,
  loginMemberSchema,
  registerAdminSchema,
} from "@dineout/shared";
import { prisma } from "../db/prisma.js";
import { randomId } from "../lib/crypto.js";
import { conflict, notFound, unauthorized } from "../lib/errors.js";
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../lib/tokens.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Terlalu banyak percobaan. Coba lagi nanti." } },
});

export function publicUser(user: {
  id: string;
  accountType: "admin" | "member";
  email: string | null;
  displayName: string;
}) {
  return {
    id: user.id,
    accountType: user.accountType,
    email: user.accountType === "admin" ? user.email : null,
    displayName: user.displayName,
  };
}

interface SessionTarget {
  groupId?: string | null;
  role?: "admin" | "mod" | "member" | null;
}

async function issueSession(
  res: import("express").Response,
  user: { id: string; accountType: "admin" | "member" },
  session: SessionTarget = {},
) {
  const groupId = session.groupId ?? null;
  const accessToken = signAccessToken({
    sub: user.id,
    accountType: user.accountType,
    groupId,
    role: session.role ?? null,
  });
  const refresh = signRefreshToken(user.id);
  await prisma.refreshToken.create({
    data: {
      id: refresh.jti,
      userId: user.id,
      groupId,
      expiresAt: refresh.expiresAt,
    },
  });
  setAuthCookies(res, accessToken, refresh.token);
}

router.post("/admin/register", loginLimiter, async (req, res, next) => {
  try {
    const input = registerAdminSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw conflict("Email sudah terdaftar");

    const user = await prisma.user.create({
      data: {
        id: randomId(),
        accountType: "admin",
        email: input.email,
        passwordHash: await bcrypt.hash(input.password, 12),
        displayName: input.displayName,
      },
    });

    await issueSession(res, user);
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post("/admin/login", loginLimiter, async (req, res, next) => {
  try {
    const input = loginAdminSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || user.accountType !== "admin") {
      throw unauthorized("Email atau password salah");
    }
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw unauthorized("Email atau password salah");

    await issueSession(res, user);
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post("/member/login", loginLimiter, async (req, res, next) => {
  try {
    const input = loginMemberSchema.parse(req.body);
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_username: { groupId: input.groupId, username: input.username } },
      include: { user: true },
    });
    if (!membership || !membership.username) {
      throw unauthorized("Username atau password salah");
    }
    const ok = await bcrypt.compare(input.password, membership.user.passwordHash);
    if (!ok) throw unauthorized("Username atau password salah");

    await issueSession(res, membership.user, {
      groupId: membership.groupId,
      role: membership.role,
    });
    res.json({ user: publicUser(membership.user) });
  } catch (err) {
    next(err);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw unauthorized("Sesi tidak ditemukan");
    const claims = verifyRefreshToken(token);
    if (!claims) throw unauthorized("Sesi tidak valid");

    const stored = await prisma.refreshToken.findUnique({ where: { id: claims.jti } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw unauthorized("Sesi sudah berakhir");
    }

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) throw unauthorized("Akun tidak ditemukan");

    const role = stored.groupId
      ? (await prisma.groupMember.findUnique({
          where: { groupId_userId: { groupId: stored.groupId, userId: user.id } },
          select: { role: true },
        }))?.role ?? null
      : null;

    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    await issueSession(res, user, { groupId: stored.groupId, role });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      const claims = verifyRefreshToken(token);
      if (claims) {
        await prisma.refreshToken
          .update({ where: { id: claims.jti }, data: { revokedAt: new Date() } })
          .catch(() => undefined);
      }
    }
    clearAuthCookies(res);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = req.currentUser!;
    let group: { id: string; name: string; role: string } | null = null;
    if (req.auth?.groupId) {
      const membership = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: req.auth.groupId, userId: user.id } },
        include: { group: { select: { id: true, name: true } } },
      });
      if (membership) {
        group = { id: membership.group.id, name: membership.group.name, role: membership.role };
      }
    }
    res.json({
      user: publicUser(user),
      group,
      hasGeminiKey: Boolean(user.geminiKeyEncrypted),
    });
  } catch (err) {
    next(err);
  }
});

router.patch("/password", requireAuth, async (req, res, next) => {
  try {
    const input = changePasswordSchema.parse(req.body);
    const user = req.currentUser!;
    const ok = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!ok) throw unauthorized("Password saat ini salah");

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(input.newPassword, 12) },
    });
    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export { router as authRouter };
