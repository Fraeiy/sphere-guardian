import type { ClockPort, HealthMonitorPort, IdPort } from "@/domain/ports";
import type {
  Anomaly,
  AnomalyThresholds,
  DecisionReasoning,
  EcosystemProject,
  HealthStatus,
  MetricSnapshot,
} from "@/domain/types";
import { TESTNET2_ENDPOINTS } from "@/infrastructure/sphere/public-config";
import {
  resolveTrackedApps,
  type TrackedApp,
} from "@/infrastructure/seed/tracked-apps";
import { logger } from "@/infrastructure/logging/logger";

interface ProbeTarget {
  id: string;
  name: string;
  slug: string;
  url: string;
  method: "GET" | "HEAD";
  tags: string[];
  kind: "app" | "infra";
  /** Apps require 2xx/3xx; infra may treat 404/405 as alive */
  strictHttp?: boolean;
}

const INFRA_TARGETS: ProbeTarget[] = [
  {
    id: "proj_token_engine",
    name: "Token Engine Gateway",
    slug: "token-engine",
    url: TESTNET2_ENDPOINTS.gateway,
    method: "GET",
    tags: ["settlement", "tokens", "core", "infra", "live"],
    kind: "infra",
  },
  {
    id: "proj_wallet_api",
    name: "Wallet API Gateway",
    slug: "wallet-api",
    url: TESTNET2_ENDPOINTS.walletApi,
    method: "GET",
    tags: ["payments", "delivery", "core", "infra", "live"],
    kind: "infra",
  },
  {
    id: "proj_sphere_market",
    name: "Sphere Market API",
    slug: "sphere-market",
    url: TESTNET2_ENDPOINTS.marketApi,
    method: "GET",
    tags: ["marketplace", "intents", "core", "infra", "live"],
    kind: "infra",
  },
  {
    id: "proj_token_registry",
    name: "Token Registry",
    slug: "token-registry",
    url: TESTNET2_ENDPOINTS.tokenRegistry,
    method: "GET",
    tags: ["tokens", "registry", "infra", "live"],
    kind: "infra",
  },
];

function appToTarget(app: TrackedApp): ProbeTarget {
  return {
    id: app.id,
    name: app.name,
    slug: app.slug,
    url: app.url,
    method: "GET",
    tags: app.tags,
    kind: app.kind,
    strictHttp: app.kind === "app",
  };
}

function resolveProbeTargets(): ProbeTarget[] {
  const includeInfra = process.env.GUARDIAN_INCLUDE_INFRA !== "false";
  const apps = resolveTrackedApps().map(appToTarget);
  return includeInfra ? [...apps, ...INFRA_TARGETS] : apps;
}

interface ProbeResult {
  ok: boolean;
  latencyMs: number;
  statusCode?: number;
  error?: string;
}

/**
 * Live ecosystem health — probes real app URLs (sphere-2048, sphereflow, …)
 * and optional Unicity Testnet v2 infrastructure endpoints.
 */
export class LiveEcosystemHealthEngine implements HealthMonitorPort {
  private history = new Map<string, ProbeResult[]>();
  private consecutiveFailures = new Map<string, number>();
  private readonly targets: ProbeTarget[];

  constructor(
    private readonly thresholds: AnomalyThresholds,
    private readonly ids: IdPort,
    private readonly clock: ClockPort,
    private readonly extra?: {
      getNetworkStats?: () => Promise<{
        activeAgents: number;
        intentCount: number;
        serviceRequests: number;
      }>;
      targets?: ProbeTarget[];
    }
  ) {
    this.targets = extra?.targets ?? resolveProbeTargets();
  }

  async collectProjects(): Promise<EcosystemProject[]> {
    const now = this.clock.nowIso();
    const networkStats = this.extra?.getNetworkStats
      ? await this.extra.getNetworkStats().catch(() => null)
      : null;

    const results = await Promise.all(
      this.targets.map(async (target) => {
        const probe = await this.probe(target);
        const hist = this.history.get(target.id) ?? [];
        hist.push(probe);
        if (hist.length > 30) hist.shift();
        this.history.set(target.id, hist);

        if (probe.ok) this.consecutiveFailures.set(target.id, 0);
        else
          this.consecutiveFailures.set(
            target.id,
            (this.consecutiveFailures.get(target.id) ?? 0) + 1
          );

        const failRate = failureRate(hist);
        const uptime = Math.max(0, 100 - failRate);
        const status = deriveStatus(probe, failRate, uptime, this.thresholds);

        // Only measured fields are non-zero. Users/agents/storage/tx rates are
        // NOT inventable from a public URL probe — keep them at 0.
        const project: EcosystemProject = {
          id: target.id,
          name: target.name,
          slug: target.slug,
          url: target.url,
          status,
          apiLatencyMs: probe.latencyMs,
          responseTimeMs: probe.latencyMs,
          storageUtilizationPct: 0,
          uptimePct: uptime,
          failureRatePct: failRate,
          txFailureRatePct: 0,
          messagingFailureRatePct: 0,
          paymentFailureRatePct: 0,
          activeUsers: 0,
          activeAgents: 0,
          lastCheckedAt: now,
          tags: [
            ...target.tags,
            probe.ok ? "up" : "down",
            probe.statusCode != null
              ? `http-${probe.statusCode}`
              : "http-err",
          ],
        };
        return project;
      })
    );

    // Optional Nostr relay reachability (infra)
    if (process.env.GUARDIAN_INCLUDE_INFRA !== "false") {
      const relayHistKey = "proj_nostr_relay";
      const relayProbe = await this.probeWsHint(TESTNET2_ENDPOINTS.nostrRelay);
      const rHist = this.history.get(relayHistKey) ?? [];
      rHist.push(relayProbe);
      if (rHist.length > 30) rHist.shift();
      this.history.set(relayHistKey, rHist);
      const rFail = failureRate(rHist);
      const rUp = Math.max(0, 100 - rFail);
      results.push({
        id: relayHistKey,
        name: "Nostr Relay Mesh",
        slug: "nostr-relay",
        url: TESTNET2_ENDPOINTS.nostrRelay,
        status: deriveStatus(relayProbe, rFail, rUp, this.thresholds),
        apiLatencyMs: relayProbe.latencyMs,
        responseTimeMs: relayProbe.latencyMs,
        storageUtilizationPct: 0,
        uptimePct: rUp,
        failureRatePct: rFail,
        txFailureRatePct: 0,
        messagingFailureRatePct: 0,
        paymentFailureRatePct: 0,
        activeUsers: 0,
        activeAgents: 0,
        lastCheckedAt: now,
        tags: [
          "messaging",
          "identity",
          "infra",
          "live",
          relayProbe.ok ? "up" : "down",
          relayProbe.statusCode != null
            ? `http-${relayProbe.statusCode}`
            : "http-err",
        ],
      });
    }

    // Apps first for dashboard readability
    results.sort((a, b) => {
      const aApp = a.tags.includes("app") ? 0 : 1;
      const bApp = b.tags.includes("app") ? 0 : 1;
      if (aApp !== bApp) return aApp - bApp;
      return a.name.localeCompare(b.name);
    });

    logger.info("Live health probes complete", {
      total: results.length,
      apps: results.filter((r) => r.tags.includes("app")).length,
      healthy: results.filter((r) => r.status === "healthy").length,
      degraded: results.filter((r) => r.status === "degraded").length,
      unhealthy: results.filter((r) => r.status === "unhealthy").length,
    });

    return results;
  }

  async collectMetrics(projects: EcosystemProject[]): Promise<MetricSnapshot[]> {
    const now = this.clock.nowIso();
    const networkStats = this.extra?.getNetworkStats
      ? await this.extra.getNetworkStats().catch(() => null)
      : null;

    const apps = projects.filter((p) => (p.tags ?? []).includes("app"));
    const latencySource = apps.length ? apps : projects;
    const upCount = projects.filter((p) => p.status === "healthy").length;
    const downCount = projects.filter((p) => p.status === "unhealthy").length;

    // Metrics series: only real probe aggregates + optional live market counts.
    const aggregate: MetricSnapshot = {
      id: this.ids.generate("metric"),
      timestamp: now,
      latencyMs: avg(latencySource.map((p) => p.apiLatencyMs)),
      usage: upCount, // # targets currently healthy (not "users")
      payments: 0,
      transactions: projects.length,
      incidents: projects.filter((p) => p.status !== "healthy").length,
      activeAgents: networkStats?.activeAgents ?? 0,
      serviceRequests: networkStats?.serviceRequests ?? networkStats?.intentCount ?? 0,
      uptimePct: avg(projects.map((p) => p.uptimePct)),
      storageUtilizationPct: downCount, // reuse slot as "down count" for charts only
    };

    const perProject = projects.map((p) => ({
      id: this.ids.generate("metric"),
      timestamp: now,
      projectId: p.id,
      latencyMs: p.apiLatencyMs,
      usage: p.status === "healthy" ? 1 : 0,
      payments: 0,
      transactions: 0,
      incidents: p.status === "healthy" ? 0 : 1,
      activeAgents: 0,
      serviceRequests: 0,
      uptimePct: p.uptimePct,
      storageUtilizationPct: 0,
    }));

    return [aggregate, ...perProject];
  }

  async detectAnomalies(
    projects: EcosystemProject[],
    _history: MetricSnapshot[]
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    const t = this.thresholds;
    const now = this.clock.nowIso();

    for (const p of projects) {
      const checks: Array<{
        metric: string;
        observed: number;
        baseline: number;
        threshold: number;
        direction: "above" | "below";
        label: string;
      }> = [
        {
          metric: "api_latency_ms",
          observed: p.apiLatencyMs,
          baseline: 200,
          threshold: t.apiLatencyMs,
          direction: "above",
          label: "API latency",
        },
        {
          metric: "uptime_pct",
          observed: p.uptimePct,
          baseline: 99.5,
          threshold: t.uptimePctMin,
          direction: "below",
          label: "Uptime",
        },
        {
          metric: "failure_rate_pct",
          observed: p.failureRatePct,
          baseline: 0.5,
          threshold: t.failureRatePct,
          direction: "above",
          label: "Failure rate",
        },
        {
          metric: "response_time_ms",
          observed: p.responseTimeMs,
          baseline: 250,
          threshold: t.responseTimeMs,
          direction: "above",
          label: "Response time",
        },
      ];

      // Hard down: full outage anomaly
      if (p.status === "unhealthy" && p.failureRatePct >= 50) {
        checks.push({
          metric: "availability",
          observed: 0,
          baseline: 1,
          threshold: 1,
          direction: "below",
          label: "Availability",
        });
      }

      for (const c of checks) {
        const breached =
          c.direction === "above"
            ? c.observed > c.threshold
            : c.observed < c.threshold;
        if (!breached) continue;

        const severity =
          c.metric === "availability"
            ? "critical"
            : c.direction === "above"
              ? c.observed > c.threshold * 2
                ? "critical"
                : c.observed > c.threshold * 1.4
                  ? "high"
                  : "medium"
              : c.observed < c.threshold - 2
                ? "critical"
                : "high";

        const reasoning: DecisionReasoning = {
          whyAbnormal: `Live probe of ${p.name} (${p.url ?? "n/a"}) shows ${c.label}=${c.observed.toFixed(2)} vs threshold ${c.threshold}.`,
          confidence: clamp(
            0.72 +
              Math.abs(c.observed - c.threshold) / (c.threshold || 1) * 0.15,
            0.72,
            0.98
          ),
          suggestedAction: `Publish a diagnostics intent on Sphere Market for ${p.name} and settle with the best live provider under budget.`,
          severity,
          expectedImpact:
            severity === "critical"
              ? `Users hitting ${p.url ?? p.name} may see outages; agent economy flows depending on it are at risk.`
              : `Elevated latency/error rates will degrade experience for ${p.name}.`,
          evidence: [
            `url=${p.url ?? "n/a"}`,
            `${c.metric}=${c.observed}`,
            `threshold=${c.threshold}`,
            `status=${p.status}`,
            `source=live-url-probe`,
          ],
          model: "live-probe-v1",
        };

        anomalies.push({
          id: this.ids.generate("anomaly"),
          projectId: p.id,
          projectName: p.name,
          metric: c.metric,
          observedValue: c.observed,
          baselineValue: c.baseline,
          threshold: c.threshold,
          direction: c.direction,
          detectedAt: now,
          reasoning,
        });
      }
    }

    const byProject = new Map<string, Anomaly>();
    const rank = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
    for (const a of anomalies) {
      const existing = byProject.get(a.projectId);
      if (
        !existing ||
        rank[a.reasoning.severity] > rank[existing.reasoning.severity]
      ) {
        byProject.set(a.projectId, a);
      }
    }
    return [...byProject.values()];
  }

  private async probe(target: ProbeTarget): Promise<ProbeResult> {
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(target.url, {
        method: target.method,
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
          "User-Agent": "SphereGuardianHealth/1.0 (+https://sphere-guardian.vercel.app)",
        },
        cache: "no-store",
        redirect: "follow",
      });
      const latencyMs = Date.now() - started;

      let alive: boolean;
      if (target.strictHttp) {
        // Product apps: success = 2xx / 3xx
        alive = res.status >= 200 && res.status < 400;
      } else {
        // Infra: many bare GETs return 404/405 but host is up
        alive =
          (res.status >= 200 && res.status < 500) ||
          res.status === 404 ||
          res.status === 405;
      }

      return {
        ok: alive,
        latencyMs,
        statusCode: res.status,
        error: alive ? undefined : `HTTP ${res.status}`,
      };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async probeWsHint(wsUrl: string): Promise<ProbeResult> {
    const started = Date.now();
    const httpHint = wsUrl
      .replace(/^wss:/, "https:")
      .replace(/^ws:/, "http:");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);
      const res = await fetch(httpHint, {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
      }).catch(() => null);
      clearTimeout(timeout);
      const latencyMs = Date.now() - started;
      if (res) {
        return { ok: true, latencyMs, statusCode: res.status };
      }
      return { ok: false, latencyMs, error: "Relay host unreachable" };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

function failureRate(hist: ProbeResult[]): number {
  if (!hist.length) return 0;
  const fails = hist.filter((h) => !h.ok).length;
  return (fails / hist.length) * 100;
}

function deriveStatus(
  probe: ProbeResult,
  failRate: number,
  uptime: number,
  t: AnomalyThresholds
): HealthStatus {
  if (!probe.ok || failRate > t.failureRatePct * 2 || uptime < t.uptimePctMin - 2) {
    return "unhealthy";
  }
  if (
    probe.latencyMs > t.apiLatencyMs ||
    failRate > t.failureRatePct ||
    uptime < t.uptimePctMin
  ) {
    return "degraded";
  }
  return "healthy";
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
