import pino from "pino";
import { env } from "./env.js";

/**
 * Logger dengan redaksi. Header sesi, cookie, dan field yang mengandung
 * API key tidak pernah masuk ke log.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "*.apiKey",
      "*.geminiKey",
      "*.api_key",
      "*.key",
      "geminiKey",
      "apiKey",
    ],
    censor: "[redacted]",
  },
  base: undefined,
});
