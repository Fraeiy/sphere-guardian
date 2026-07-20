import { describe, expect, it } from "vitest";
import { withRetry } from "../src/infrastructure/utils/retry";
import { InMemoryRateLimiter } from "../src/infrastructure/utils/rate-limiter";

describe("withRetry", () => {
  it("retries then succeeds", async () => {
    let n = 0;
    const result = await withRetry(
      async () => {
        n += 1;
        if (n < 3) throw new Error("transient");
        return "ok";
      },
      { attempts: 4, baseDelayMs: 1, maxDelayMs: 5 }
    );
    expect(result).toBe("ok");
    expect(n).toBe(3);
  });

  it("does not retry validation failures", async () => {
    let n = 0;
    await expect(
      withRetry(
        async () => {
          n += 1;
          throw new Error("VALIDATION failed");
        },
        { attempts: 3, baseDelayMs: 1 }
      )
    ).rejects.toThrow(/VALIDATION/);
    expect(n).toBe(1);
  });
});

describe("InMemoryRateLimiter", () => {
  it("enforces fixed window limits", () => {
    const rl = new InMemoryRateLimiter();
    expect(rl.tryAcquire("k", 2, 10_000)).toBe(true);
    expect(rl.tryAcquire("k", 2, 10_000)).toBe(true);
    expect(rl.tryAcquire("k", 2, 10_000)).toBe(false);
  });
});
