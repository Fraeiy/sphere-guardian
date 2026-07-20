import { randomUUID } from "crypto";
import type { IdPort } from "@/domain/ports";

export class UuidIdProvider implements IdPort {
  generate(prefix = "id"): string {
    return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  }
}

export const ids = new UuidIdProvider();
