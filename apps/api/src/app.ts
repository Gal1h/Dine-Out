import path from "node:path";
import fs from "node:fs";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { env, isProd } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./lib/errors.js";
import { UPLOAD_DIR } from "./lib/upload.js";
import { authRouter } from "./routes/auth.js";
import { groupsRouter } from "./routes/groups.js";
import { votesRouter } from "./routes/votes.js";
import { summariesRouter } from "./routes/summaries.js";
import { billsRouter } from "./routes/bills.js";
import { profileRouter } from "./routes/profile.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "same-site" },
      contentSecurityPolicy: isProd ? undefined : false,
    }),
  );
  app.use(
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use((req, res, next) => {
    const started = Date.now();
    res.on("finish", () => {
      logger.info(
        {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          ms: Date.now() - started,
        },
        "request",
      );
    });
    next();
  });

  app.use(
    "/uploads",
    express.static(UPLOAD_DIR, {
      maxAge: "7d",
      immutable: true,
      index: false,
      dotfiles: "ignore",
    }),
  );

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/groups", groupsRouter);
  app.use("/api/profile", profileRouter);
  app.use("/api", votesRouter);
  app.use("/api", summariesRouter);
  app.use("/api", billsRouter);

  const webDist = path.resolve(process.cwd(), "../web/dist");
  if (isProd && fs.existsSync(webDist)) {
    app.use(express.static(webDist, { index: false, maxAge: "1h" }));
    app.get("*", (_req, res) => res.sendFile(path.join(webDist, "index.html")));
  }

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Endpoint tidak ditemukan" } });
  });

  app.use(errorHandler);

  return app;
}
