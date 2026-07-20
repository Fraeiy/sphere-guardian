import { promises as fs } from "fs";
import path from "path";
import type { StateStorePort } from "@/domain/ports";
import type { ActivityEvent, GuardianStateSnapshot } from "@/domain/types";
import { logger } from "@/infrastructure/logging/logger";

/**
 * Durable JSON snapshot store. Swap for PostgresStateStore when DATABASE_URL is set.
 */
export class FileStateStore implements StateStorePort {
  private readonly filePath: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(dataDir = process.env.GUARDIAN_DATA_DIR ?? ".data") {
    const root = path.isAbsolute(dataDir)
      ? dataDir
      : path.join(process.cwd(), dataDir);
    this.filePath = path.join(root, "guardian-state.json");
  }

  async load(): Promise<GuardianStateSnapshot | null> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      return JSON.parse(raw) as GuardianStateSnapshot;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      logger.error("Failed to load state store", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async save(state: GuardianStateSnapshot): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const tmp = `${this.filePath}.tmp`;
      // Cap large arrays for disk efficiency while keeping runtime full in memory.
      const toPersist: GuardianStateSnapshot = {
        ...state,
        activity: state.activity.slice(0, 500),
        metrics: state.metrics.slice(0, 500),
        messages: state.messages.slice(0, 200),
      };
      await fs.writeFile(tmp, JSON.stringify(toPersist, null, 2), "utf8");
      await fs.rename(tmp, this.filePath);
    });
    return this.writeQueue;
  }

  async appendActivity(event: ActivityEvent): Promise<void> {
    const current = await this.load();
    if (!current) return;
    current.activity = [event, ...current.activity].slice(0, 500);
    await this.save(current);
  }
}
