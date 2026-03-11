/**
 * Load environment variables BEFORE any other module reads them.
 *
 * In ESM, module bodies are evaluated in depth-first import order.
 * By isolating dotenv here and importing this file first in index.ts,
 * we guarantee process.env is populated before auth.ts (or any other
 * module) tries to read JWT_SECRET or SMTP_HOST.
 */
import dotenv from "dotenv";
import { z } from "zod";

const fileEnv: Record<string, string> = {};
dotenv.config({ path: ".env", processEnv: fileEnv, quiet: true });
dotenv.config({ path: ".env.local", processEnv: fileEnv, override: true, quiet: true });

for (const [key, value] of Object.entries(fileEnv)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

if (process.env.VITEST === "true") {
  process.env.NODE_ENV = "test";
}

if ((process.env.NODE_ENV === "test" || process.env.VITEST === "true") && !process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-jwt-secret-for-vitest-only-12345";
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long"),
  PORT: z.coerce.number().int().positive().max(65535).default(3001),
  CORS_ORIGIN: z.string().trim().optional(),
  APP_URL: z.string().trim().optional(),
  MAX_BACKUPS: z.coerce.number().int().positive().default(20),
});

const parsedEnv = envSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV ?? "development",
  JWT_SECRET: process.env.JWT_SECRET,
  PORT: process.env.PORT ?? "3001",
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  APP_URL: process.env.APP_URL,
  MAX_BACKUPS: process.env.MAX_BACKUPS ?? "20",
});

if (!parsedEnv.success) {
  console.error("CRITICAL ERROR: Invalid environment configuration.");
  for (const issue of parsedEnv.error.issues) {
    console.error(`- ${issue.path.join(".") || "env"}: ${issue.message}`);
  }
  process.exit(1);
}

if (parsedEnv.data.NODE_ENV === "production" && parsedEnv.data.JWT_SECRET === "change-me-to-a-long-random-secret") {
  console.error("CRITICAL ERROR: Replace JWT_SECRET before starting the production server.");
  process.exit(1);
}

export const env = parsedEnv.data;
