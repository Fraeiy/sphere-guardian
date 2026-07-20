import type { LoggerPort } from "@/domain/ports";

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  retryOn?: (error: unknown) => boolean;
  logger?: LoggerPort;
  label?: string;
}

const defaultRetryOn = (error: unknown): boolean => {
  if (!error) return false;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("certification_unconfirmed")) return false;
    if (msg.includes("invalid_recipient")) return false;
    if (msg.includes("validation")) return false;
    return true;
  }
  return true;
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 400;
  const maxDelayMs = options.maxDelayMs ?? 8_000;
  const factor = options.factor ?? 2;
  const retryOn = options.retryOn ?? defaultRetryOn;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const willRetry = attempt < attempts && retryOn(error);
      options.logger?.warn("Operation failed", {
        label: options.label,
        attempt,
        attempts,
        willRetry,
        error: error instanceof Error ? error.message : String(error),
      });
      if (!willRetry) break;
      const delay = Math.min(maxDelayMs, baseDelayMs * factor ** (attempt - 1));
      const jitter = Math.floor(Math.random() * 100);
      await new Promise((r) => setTimeout(r, delay + jitter));
    }
  }

  throw lastError;
}
