import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import sharp from "sharp";
import { LIMITS } from "@dineout/shared";
import { badRequest } from "./errors.js";
import { randomId } from "./crypto.js";

export const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

export async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export const uploadMenuImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITS.menuImageBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("INVALID_FILE"));
      return;
    }
    cb(null, true);
  },
});

/** Kompres ke WebP (maks lebar 1600 px) dan simpan dengan nama acak. */
export async function saveMenuImage(buffer: Buffer): Promise<string> {
  let output: Buffer;
  try {
    output = await sharp(buffer)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw badRequest("Gambar menu tidak bisa dibaca");
  }
  const filename = `${randomId()}.webp`;
  await ensureUploadDir();
  await fs.writeFile(path.join(UPLOAD_DIR, filename), output);
  return filename;
}

export async function deleteMenuImage(filename: string | null | undefined) {
  if (!filename) return;
  const target = path.join(UPLOAD_DIR, path.basename(filename));
  await fs.unlink(target).catch(() => undefined);
}
