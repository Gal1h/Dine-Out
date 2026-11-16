import crypto from "node:crypto";
import { env } from "./env.js";
import { logger } from "./logger.js";

/** Tipe byte yang diterima kolom Bytes Prisma. */
export type Bytes = Uint8Array<ArrayBuffer>;

/**
 * Kunci enkripsi diambil dari GEMINI_ENC_KEY (base64 32 byte).
 * Jika nilainya bukan 32 byte, diturunkan dengan SHA-256 agar tetap 32 byte.
 */
function encryptionKey(): Buffer {
  const raw = Buffer.from(env.GEMINI_ENC_KEY, "base64");
  if (raw.length === 32) return raw;
  logger.warn("GEMINI_ENC_KEY bukan 32 byte base64; diturunkan dengan SHA-256");
  return crypto.createHash("sha256").update(env.GEMINI_ENC_KEY, "utf8").digest();
}

export interface SealedSecret {
  ciphertext: Bytes;
  iv: Bytes;
  tag: Bytes;
}

const toBytes = (buffer: Buffer): Bytes => new Uint8Array(buffer);

export function sealSecret(plain: string): SealedSecret {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext: toBytes(ciphertext), iv: toBytes(iv), tag: toBytes(tag) };
}

export function openSecret(sealed: {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  tag: Uint8Array;
}): string {
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), sealed.iv);
  decipher.setAuthTag(sealed.tag);
  return Buffer.concat([decipher.update(sealed.ciphertext), decipher.final()]).toString("utf8");
}

export function randomId(): string {
  return crypto.randomUUID();
}
