import type { StateStorePort } from "@/domain/ports";
import type { ActivityEvent, GuardianStateSnapshot } from "@/domain/types";
import { logger } from "@/infrastructure/logging/logger";

type PgPool = {
  query: (
    text: string,
    params?: unknown[]
  ) => Promise<{ rows: Array<Record<string, unknown>> }>;
  end: () => Promise<void>;
};

/**
 * Optional PostgreSQL state store.
 * Activated only when DATABASE_URL is present.
 * `pg` is loaded via runtime Function import to keep it optional for builds.
 */
export class PostgresStateStore implements StateStorePort {
  private pool: PgPool | null = null;

  constructor(private readonly connectionString: string) {}

  private async getPool(): Promise<PgPool> {
    if (this.pool) return this.pool;

    // Prevent bundlers from statically resolving optional dependency `pg`.
    const dynamicImport = new Function(
      "specifier",
      "return import(specifier)"
    ) as (specifier: string) => Promise<{
      Pool: new (config: { connectionString: string }) => PgPool;
    }>;

    let mod: { Pool: new (config: { connectionString: string }) => PgPool };
    try {
      mod = await dynamicImport("pg");
    } catch {
      throw new Error(
        "pg package not installed. Run: npm install pg @types/pg"
      );
    }

    this.pool = new mod.Pool({ connectionString: this.connectionString });
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS guardian_state (
        id TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    return this.pool;
  }

  async load(): Promise<GuardianStateSnapshot | null> {
    try {
      const pool = await this.getPool();
      const res = await pool.query(
        `SELECT payload FROM guardian_state WHERE id = $1`,
        ["main"]
      );
      if (!res.rows[0]) return null;
      return res.rows[0].payload as GuardianStateSnapshot;
    } catch (error) {
      logger.error("Postgres state load failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async save(state: GuardianStateSnapshot): Promise<void> {
    const pool = await this.getPool();
    const compact = {
      ...state,
      activity: state.activity.slice(0, 500),
      metrics: state.metrics.slice(0, 500),
      messages: state.messages.slice(0, 200),
    };
    await pool.query(
      `INSERT INTO guardian_state (id, payload, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
      ["main", JSON.stringify(compact)]
    );
  }

  async appendActivity(event: ActivityEvent): Promise<void> {
    const current = await this.load();
    if (!current) return;
    current.activity = [event, ...current.activity].slice(0, 500);
    await this.save(current);
  }
}
