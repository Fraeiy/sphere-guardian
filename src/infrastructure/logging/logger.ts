import type { LoggerPort } from "@/domain/ports";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function currentLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return "info";
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel()];
}

function format(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    service: "sphere-guardian-ai",
    message,
    ...(meta ?? {}),
  };
  return JSON.stringify(entry);
}

export class StructuredLogger implements LoggerPort {
  constructor(private readonly scope = "guardian") {}

  debug(message: string, meta?: Record<string, unknown>): void {
    if (!shouldLog("debug")) return;
    console.debug(format("debug", message, { scope: this.scope, ...meta }));
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (!shouldLog("info")) return;
    console.info(format("info", message, { scope: this.scope, ...meta }));
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (!shouldLog("warn")) return;
    console.warn(format("warn", message, { scope: this.scope, ...meta }));
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (!shouldLog("error")) return;
    console.error(format("error", message, { scope: this.scope, ...meta }));
  }

  child(scope: string): StructuredLogger {
    return new StructuredLogger(`${this.scope}.${scope}`);
  }
}

export const logger = new StructuredLogger();
