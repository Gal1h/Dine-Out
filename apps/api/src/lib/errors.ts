import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { logger } from "./logger.js";

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new AppError(400, "BAD_REQUEST", message);
export const unauthorized = (message = "Sesi tidak valid") =>
  new AppError(401, "UNAUTHENTICATED", message);
export const forbidden = (message = "Anda tidak punya akses") => new AppError(403, "FORBIDDEN", message);
export const notFound = (message = "Data tidak ditemukan") => new AppError(404, "NOT_FOUND", message);
export const conflict = (message: string) => new AppError(409, "CONFLICT", message);
export const tooMany = (message: string) => new AppError(429, "RATE_LIMITED", message);
export const upstream = (message: string) => new AppError(502, "UPSTREAM_ERROR", message);

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }

  if (err instanceof ZodError) {
    const first = err.issues[0];
    const message = first?.message ?? "Input tidak valid";
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message } });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res
        .status(409)
        .json({ error: { code: "DUPLICATE", message: "Data sudah ada. Periksa kembali isian Anda." } });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Data tidak ditemukan" } });
    }
  }

  const message = err instanceof Error ? err.message : "Terjadi kesalahan";
  if (message === "INVALID_FILE" || message.includes("Specified file failed upload test")) {
    return res
      .status(400)
      .json({ error: { code: "INVALID_FILE", message: "File harus berupa gambar" } });
  }
  if (message.includes("File too large")) {
    return res
      .status(400)
      .json({ error: { code: "FILE_TOO_LARGE", message: "Ukuran gambar maksimal 5 MB" } });
  }

  logger.error({ err }, "unhandled error");
  return res
    .status(500)
    .json({ error: { code: "INTERNAL", message: "Terjadi kesalahan di server" } });
}
