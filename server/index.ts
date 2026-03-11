// env.ts MUST be the first import — it loads and validates runtime config
// before any other module reads process.env (ESM ordering).
import { env } from "./env.js";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import db from "./db.js";
import { logger } from "./lib/logger.js";

// Middleware
import { authenticateToken } from "./middleware/auth.js";

// Route modules
import authRouter from "./routes/auth.js";
import publicRouter from "./routes/public.js";
import customersRouter from "./routes/customers.js";
import dogsRouter from "./routes/dogs.js";
import appointmentsRouter from "./routes/appointments.js";
import servicesRouter, { addOnRouter } from "./routes/services.js";
import settingsRouter from "./routes/settings.js";
import paymentsRouter from "./routes/payments.js";
import formsRouter, { formSubmissionsRouter } from "./routes/forms.js";
import reportsRouter from "./routes/reports.js";
import messagingRouter from "./routes/messaging.js";

const app = express();
const isTestEnv = env.NODE_ENV === "test";
const isProduction = env.NODE_ENV === "production";

// --- Global middleware ---
app.use(
  cors({
    origin: env.CORS_ORIGIN || (isProduction ? false : "http://localhost:3000"),
    credentials: true,
  }),
);
if (!isTestEnv) {
  app.use(morgan(isProduction ? "combined" : "dev"));
}
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

// --- Security headers ---
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

// ══════════════════════════════════════════════
// Health check (no auth required)
// ══════════════════════════════════════════════
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ══════════════════════════════════════════════
// Rate limiter for public endpoints
// ══════════════════════════════════════════════
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests from this IP, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ══════════════════════════════════════════════
// ROUTES — Public (no auth required)
// ══════════════════════════════════════════════
app.use("/api", authRouter); // /api/auth/login, /api/auth/password, /api/auth/me, /api/staff
app.use("/api/public", publicLimiter, publicRouter); // /api/public/services, /api/public/schedule, etc.

// ══════════════════════════════════════════════
// ROUTES — Authenticated (token required)
// ══════════════════════════════════════════════
app.use("/api", authenticateToken); // Everything below requires a valid JWT

app.use("/api/customers", customersRouter);
app.use("/api/dogs", dogsRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/services", servicesRouter);
app.use("/api/add-ons", addOnRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/forms", formsRouter);
app.use("/api/form-submissions", formSubmissionsRouter); // backward-compatible path
app.use("/api", reportsRouter); // /api/search, /api/audit-log, /api/analytics, /api/reports
app.use("/api/messages", messagingRouter);

if (isProduction) {
  const clientDistDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const clientIndexPath = path.join(clientDistDir, "index.html");

  if (fs.existsSync(clientIndexPath)) {
    app.use(express.static(clientDistDir, { index: false }));
    app.get(/^(?!\/api(?:\/|$)).*/, (_req, res, next) => {
      res.sendFile(clientIndexPath, (err) => {
        if (err) next(err);
      });
    });
  } else {
    logger.error("Production frontend bundle missing", { path: clientIndexPath });
  }
}

// ══════════════════════════════════════════════
// Global error handler — catches unhandled errors in routes
// ══════════════════════════════════════════════
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error("Unhandled route error", {
    message: err.message,
    stack: !isProduction ? err.stack : undefined,
  });
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: isProduction ? "Internal server error" : err.message || "Internal server error",
  });
});

// ══════════════════════════════════════════════
// Database backup (every 6 hours) with retention
// ══════════════════════════════════════════════
if (!isTestEnv) {
  const backupDir = path.join(process.cwd(), "data", "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const pruneOldBackups = () => {
    try {
      const files = fs
        .readdirSync(backupDir)
        .filter((f) => f.startsWith("database_backup_") && f.endsWith(".db"))
        .sort();
      while (files.length > env.MAX_BACKUPS) {
        const oldest = files.shift()!;
        fs.unlinkSync(path.join(backupDir, oldest));
        logger.info("Pruned old backup", { file: oldest });
      }
    } catch (err) {
      logger.error("Backup pruning failed", { error: (err as Error).message });
    }
  };

  setInterval(
    () => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = path.join(backupDir, `database_backup_${timestamp}.db`);
      try {
        db.backup(backupPath).then(() => {
          logger.info("Database backed up", { path: backupPath });
          pruneOldBackups();
        });
      } catch (err) {
        logger.error("Database backup failed", { error: (err as Error).message });
      }
    },
    6 * 60 * 60 * 1000,
  );
}

if (!isTestEnv) {
  app.listen(env.PORT, () => {
    logger.info(`API server running on port ${env.PORT}`);
  });
}
export default app;
