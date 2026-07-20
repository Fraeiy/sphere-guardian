import type { RateLimiterPort } from "@/domain/ports";

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Sliding fixed-window rate limiter suitable for single-process guardians.
 * For multi-instance deployments, swap for Redis-backed limiter.
 */
export class InMemoryRateLimiter implements RateLimiterPort {
  private readonly buckets = new Map<string, Bucket>();

  tryAcquire(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (existing.count >= limit) {
      return false;
    }
    existing.count += 1;
    return true;
  }

  reset(key?: string): void {
    if (key) this.buckets.delete(key);
    else this.buckets.clear();
  }
}

export const rateLimiter = new InMemoryRateLimiter();
