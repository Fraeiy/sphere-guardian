import type { ClockPort } from "@/domain/ports";

export class SystemClock implements ClockPort {
  now(): Date {
    return new Date();
  }

  nowIso(): string {
    return this.now().toISOString();
  }

  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const clock = new SystemClock();
