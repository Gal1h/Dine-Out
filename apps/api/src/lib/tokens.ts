import jwt from "jsonwebtoken";
import type { CookieOptions, Response } from "express";
import type { GroupRole } from "@prisma/client";
import { env, isProd } from "./env.js";
import { randomId } from "./crypto.js";

export const ACCESS_COOKIE = "dineout_at";
export const REFRESH_COOKIE = "dineout_rt";
export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_DAYS = 7;

export interface AccessClaims {
  sub: string;
  typ: "access";
  accountType: "admin" | "member";
  groupId?: string | null;
  role?: GroupRole | null;
}

export interface RefreshClaims {
  sub: string;
  typ: "refresh";
  jti: string;
}

const baseCookie: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax",
  path: "/",
};

export function signAccessToken(claims: Omit<AccessClaims, "typ">): string {
  return jwt.sign({ ...claims, typ: "access" }, env.JWT_SECRET, {
    expiresIn: ACCESS_TTL_SECONDS,
  });
}

export function signRefreshToken(userId: string): { token: string; jti: string; expiresAt: Date } {
  const jti = randomId();
  const token = jwt.sign({ sub: userId, typ: "refresh", jti }, env.JWT_SECRET, {
    expiresIn: REFRESH_TTL_DAYS * 24 * 60 * 60,
  });
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  return { token, jti, expiresAt };
}

export function verifyAccessToken(token: string): AccessClaims | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AccessClaims;
    return payload.typ === "access" ? payload : null;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): RefreshClaims | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as RefreshClaims;
    return payload.typ === "refresh" && payload.jti ? payload : null;
  } catch {
    return null;
  }
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie(ACCESS_COOKIE, accessToken, { ...baseCookie, maxAge: ACCESS_TTL_SECONDS * 1000 });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookie,
    maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, baseCookie);
  res.clearCookie(REFRESH_COOKIE, baseCookie);
}
