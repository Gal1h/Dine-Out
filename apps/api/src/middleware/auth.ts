import type { NextFunction, Request, Response } from "express";
import type { GroupRole } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { forbidden, notFound, unauthorized } from "../lib/errors.js";
import { ACCESS_COOKIE, clearAuthCookies, verifyAccessToken } from "../lib/tokens.js";

/** Verifikasi access token di cookie httpOnly. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[ACCESS_COOKIE];
    if (!token) return next(unauthorized());

    const claims = verifyAccessToken(token);
    if (!claims) {
      return res
        .status(401)
        .json({ error: { code: "TOKEN_EXPIRED", message: "Sesi kedaluwarsa" } });
    }

    const user = await prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user) {
      clearAuthCookies(res);
      return next(unauthorized("Akun tidak ditemukan"));
    }

    req.auth = claims;
    req.currentUser = user;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdminAccount(req: Request, _res: Response, next: NextFunction) {
  if (!req.currentUser) return next(unauthorized());
  if (req.currentUser.accountType !== "admin") {
    return next(forbidden("Hanya admin yang bisa melakukan aksi ini"));
  }
  next();
}

/** Pastikan user adalah anggota grup (dari req.params[paramName]). */
export function requireGroupMember(paramName = "groupId") {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = req.currentUser;
      if (!user) throw unauthorized();
      const groupId = req.params[paramName];
      if (!groupId) throw notFound("Grup tidak ditemukan");

      const membership = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: user.id } },
        select: { groupId: true, role: true },
      });
      if (!membership) throw forbidden("Anda bukan anggota grup ini");

      req.membership = membership;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireGroupRole(...roles: GroupRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.membership) return next(forbidden("Anda bukan anggota grup ini"));
    if (!roles.includes(req.membership.role)) {
      return next(forbidden("Role Anda tidak diizinkan untuk aksi ini"));
    }
    next();
  };
}
