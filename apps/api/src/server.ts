import { createApp } from "./app.js";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import { ensureUploadDir } from "./lib/upload.js";
import { prisma } from "./db/prisma.js";

async function main() {
  await ensureUploadDir();
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, "DineOut API berjalan");
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "mematikan server");
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err }, "gagal menjalankan server");
  process.exit(1);
});
