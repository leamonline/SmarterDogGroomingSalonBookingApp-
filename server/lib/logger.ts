/**
 * Structured logger for PetSpa server.
 *
 * Outputs JSON in production for machine-parseable logs,
 * and pretty-prints in development for readability.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const minLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === "production" ? "info" : "debug");

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[minLevel];
}

interface LogEntry {
  level: LogLevel;
  msg: string;
  timestamp: string;
  [key: string]: unknown;
}

function emit(level: LogLevel, msg: string, extra?: Record<string, unknown>) {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    level,
    msg,
    timestamp: new Date().toISOString(),
    ...extra,
  };

  if (process.env.NODE_ENV === "production") {
    // Structured JSON for log aggregation
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn(JSON.stringify(entry));
  } else if (process.env.NODE_ENV !== "test") {
    // Pretty for dev
    const prefix = `[${entry.timestamp.slice(11, 19)}] ${level.toUpperCase().padEnd(5)}`;
    const extraStr = extra && Object.keys(extra).length > 0 ? ` ${JSON.stringify(extra)}` : "";
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn(`${prefix} ${msg}${extraStr}`);
  }
  // Silent in test
}

export const logger = {
  debug: (msg: string, extra?: Record<string, unknown>) => emit("debug", msg, extra),
  info: (msg: string, extra?: Record<string, unknown>) => emit("info", msg, extra),
  warn: (msg: string, extra?: Record<string, unknown>) => emit("warn", msg, extra),
  error: (msg: string, extra?: Record<string, unknown>) => emit("error", msg, extra),
};
