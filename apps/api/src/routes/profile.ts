import { Router } from "express";
import { geminiKeySchema, updateProfileSchema } from "@dineout/shared";
import { prisma } from "../db/prisma.js";
import { sealSecret } from "../lib/crypto.js";
import { logger } from "../lib/logger.js";
import { requireAdminAccount, requireAuth } from "../middleware/auth.js";
import { publicUser } from "./auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const user = req.currentUser!;
    res.json({ user: publicUser(user), hasGeminiKey: Boolean(user.geminiKeyEncrypted) });
  } catch (err) {
    next(err);
  }
});

router.patch("/", async (req, res, next) => {
  try {
    const input = updateProfileSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.currentUser!.id },
      data: { displayName: input.displayName },
    });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.put("/gemini-key", requireAdminAccount, async (req, res, next) => {
  try {
    const input = geminiKeySchema.parse(req.body);
    const sealed = sealSecret(input.apiKey);
    await prisma.user.update({
      where: { id: req.currentUser!.id },
      data: {
        geminiKeyEncrypted: sealed.ciphertext,
        geminiKeyIv: sealed.iv,
        geminiKeyTag: sealed.tag,
      },
    });
    logger.info({ userId: req.currentUser!.id }, "Gemini API key diperbarui");
    res.json({ hasGeminiKey: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/gemini-key", requireAdminAccount, async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.currentUser!.id },
      data: { geminiKeyEncrypted: null, geminiKeyIv: null, geminiKeyTag: null },
    });
    logger.info({ userId: req.currentUser!.id }, "Gemini API key dihapus");
    res.json({ hasGeminiKey: false });
  } catch (err) {
    next(err);
  }
});

export { router as profileRouter };
