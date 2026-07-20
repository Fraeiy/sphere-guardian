import type { HealthMonitorPort, IdPort, ClockPort } from "@/domain/ports";
import type {
  Anomaly,
  AnomalyThresholds,
  DecisionReasoning,
  EcosystemProject,
  HealthStatus,
  MetricSnapshot,
} from "@/domain/types";
import { createSeedProjects } from "@/infrastructure/seed/projects";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function jitter(base: number, amplitude: number): number {
  return base + (Math.random() * 2 - 1) * amplitude;
}

function deriveStatus(p: EcosystemProject, t: AnomalyThresholds): HealthStatus {
  if (
    p.uptimePct < t.uptimePctMin - 1 ||
    p.failureRatePct > t.failureRatePct * 2 ||
    p.apiLatencyMs > t.apiLatencyMs * 2
  ) {
    return "unhealthy";
  }
  if (
    p.uptimePct < t.uptimePctMin ||
    p.failureRatePct > t.failureRatePct ||
    p.apiLatencyMs > t.apiLatencyMs ||
    p.storageUtilizationPct > t.storageUtilizationPct ||
    p.paymentFailureRatePct > t.paymentFailureRatePct ||
    p.txFailureRatePct > t.txFailureRatePct ||
    p.messagingFailureRatePct > t.messagingFailureRatePct
  ) {
    return "degraded";
  }
  return "healthy";
}

/**
 * Ecosystem Health Engine — simulates realistic telemetry drift and
 * injects occasional anomalies so the autonomous loop can demonstrate
 * intent → negotiate → settle without external APM wiring.
 */
export class EcosystemHealthEngine implements HealthMonitorPort {
  private projects: EcosystemProject[];
  private tick = 0;
  private readonly forceAnomalyEvery: number;

  constructor(
    private readonly thresholds: AnomalyThresholds,
    private readonly ids: IdPort,
    private readonly clock: ClockPort,
    options?: { forceAnomalyEvery?: number; projects?: EcosystemProject[] }
  ) {
    this.projects = options?.projects ?? createSeedProjects(clock.nowIso());
    this.forceAnomalyEvery = options?.forceAnomalyEvery ?? 4;
  }

  async collectProjects(): Promise<EcosystemProject[]> {
    this.tick += 1;
    const now = this.clock.nowIso();
    const injectAnomaly = this.tick % this.forceAnomalyEvery === 0;

    this.projects = this.projects.map((p, index) => {
      let next: EcosystemProject = {
        ...p,
        apiLatencyMs: clamp(jitter(p.apiLatencyMs * 0.92 + 40, 40), 40, 2500),
        responseTimeMs: clamp(jitter(p.responseTimeMs * 0.92 + 50, 50), 50, 3000),
        storageUtilizationPct: clamp(
          jitter(p.storageUtilizationPct + 0.15, 1.5),
          10,
          99
        ),
        uptimePct: clamp(jitter(99.9, 0.08), 95, 100),
        failureRatePct: clamp(Math.abs(jitter(0.4, 0.35)), 0, 15),
        txFailureRatePct: clamp(Math.abs(jitter(0.25, 0.25)), 0, 12),
        messagingFailureRatePct: clamp(Math.abs(jitter(0.3, 0.3)), 0, 12),
        paymentFailureRatePct: clamp(Math.abs(jitter(0.2, 0.2)), 0, 10),
        activeUsers: Math.max(10, Math.round(jitter(p.activeUsers, p.activeUsers * 0.05))),
        activeAgents: Math.max(5, Math.round(jitter(p.activeAgents, p.activeAgents * 0.08))),
        lastCheckedAt: now,
      };

      // Periodically inject a clear anomaly into one project.
      if (injectAnomaly && index === this.tick % this.projects.length) {
        const kind = this.tick % 4;
        if (kind === 0) {
          next = {
            ...next,
            apiLatencyMs: this.thresholds.apiLatencyMs * (1.6 + Math.random()),
            responseTimeMs: this.thresholds.responseTimeMs * (1.5 + Math.random() * 0.5),
          };
        } else if (kind === 1) {
          next = {
            ...next,
            paymentFailureRatePct:
              this.thresholds.paymentFailureRatePct * (2.5 + Math.random()),
            txFailureRatePct: this.thresholds.txFailureRatePct * (2 + Math.random()),
          };
        } else if (kind === 2) {
          next = {
            ...next,
            storageUtilizationPct: clamp(
              this.thresholds.storageUtilizationPct + 5 + Math.random() * 8,
              0,
              99.5
            ),
          };
        } else {
          next = {
            ...next,
            messagingFailureRatePct:
              this.thresholds.messagingFailureRatePct * (2.2 + Math.random()),
            uptimePct: this.thresholds.uptimePctMin - (0.5 + Math.random()),
          };
        }
      }

      next.status = deriveStatus(next, this.thresholds);
      return next;
    });

    return this.projects.map((p) => ({ ...p }));
  }

  async collectMetrics(projects: EcosystemProject[]): Promise<MetricSnapshot[]> {
    const now = this.clock.nowIso();
    const aggregate: MetricSnapshot = {
      id: this.ids.generate("metric"),
      timestamp: now,
      latencyMs: avg(projects.map((p) => p.apiLatencyMs)),
      usage: sum(projects.map((p) => p.activeUsers)),
      payments: Math.round(
        projects.reduce((a, p) => a + p.activeAgents * (1 - p.paymentFailureRatePct / 100), 0)
      ),
      transactions: Math.round(
        projects.reduce((a, p) => a + p.activeUsers * 0.35, 0)
      ),
      incidents: projects.filter((p) => p.status !== "healthy").length,
      activeAgents: sum(projects.map((p) => p.activeAgents)),
      serviceRequests: Math.round(sum(projects.map((p) => p.activeAgents)) * 0.08),
      uptimePct: avg(projects.map((p) => p.uptimePct)),
      storageUtilizationPct: avg(projects.map((p) => p.storageUtilizationPct)),
    };

    const perProject = projects.map((p) => ({
      id: this.ids.generate("metric"),
      timestamp: now,
      projectId: p.id,
      latencyMs: p.apiLatencyMs,
      usage: p.activeUsers,
      payments: Math.round(p.activeAgents * 1.2),
      transactions: Math.round(p.activeUsers * 0.4),
      incidents: p.status === "healthy" ? 0 : 1,
      activeAgents: p.activeAgents,
      serviceRequests: Math.round(p.activeAgents * 0.1),
      uptimePct: p.uptimePct,
      storageUtilizationPct: p.storageUtilizationPct,
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
          baseline: 150,
          threshold: t.apiLatencyMs,
          direction: "above",
          label: "API latency",
        },
        {
          metric: "response_time_ms",
          observed: p.responseTimeMs,
          baseline: 200,
          threshold: t.responseTimeMs,
          direction: "above",
          label: "Response time",
        },
        {
          metric: "storage_utilization_pct",
          observed: p.storageUtilizationPct,
          baseline: 50,
          threshold: t.storageUtilizationPct,
          direction: "above",
          label: "Storage utilization",
        },
        {
          metric: "uptime_pct",
          observed: p.uptimePct,
          baseline: 99.9,
          threshold: t.uptimePctMin,
          direction: "below",
          label: "Uptime",
        },
        {
          metric: "failure_rate_pct",
          observed: p.failureRatePct,
          baseline: 0.3,
          threshold: t.failureRatePct,
          direction: "above",
          label: "Failure rate",
        },
        {
          metric: "tx_failure_rate_pct",
          observed: p.txFailureRatePct,
          baseline: 0.2,
          threshold: t.txFailureRatePct,
          direction: "above",
          label: "Transaction failure rate",
        },
        {
          metric: "messaging_failure_rate_pct",
          observed: p.messagingFailureRatePct,
          baseline: 0.25,
          threshold: t.messagingFailureRatePct,
          direction: "above",
          label: "Messaging failure rate",
        },
        {
          metric: "payment_failure_rate_pct",
          observed: p.paymentFailureRatePct,
          baseline: 0.15,
          threshold: t.paymentFailureRatePct,
          direction: "above",
          label: "Payment failure rate",
        },
      ];

      for (const c of checks) {
        const breached =
          c.direction === "above"
            ? c.observed > c.threshold
            : c.observed < c.threshold;
        if (!breached) continue;

        const severity =
          c.direction === "above"
            ? c.observed > c.threshold * 2
              ? "critical"
              : c.observed > c.threshold * 1.4
                ? "high"
                : "medium"
            : c.observed < c.threshold - 1
              ? "critical"
              : "high";

        const reasoning: DecisionReasoning = {
          whyAbnormal: `${c.label} for ${p.name} is ${c.observed.toFixed(2)} (threshold ${c.threshold}, baseline ~${c.baseline}).`,
          confidence: clamp(
            0.55 + Math.abs(c.observed - c.threshold) / (c.threshold || 1) * 0.2,
            0.55,
            0.97
          ),
          suggestedAction: `Publish a diagnostics service intent for ${p.name} and settle with the best provider under budget.`,
          severity,
          expectedImpact:
            severity === "critical"
              ? "User-facing outages and failed agent settlements likely within minutes."
              : "Degraded agent experience and elevated retry load across the Sphere mesh.",
          evidence: [
            `${c.metric}=${c.observed}`,
            `threshold=${c.threshold}`,
            `project_status=${p.status}`,
            `active_agents=${p.activeAgents}`,
          ],
          model: "guardian-rules-v1",
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

    // Prefer the highest severity anomaly per project.
    const byProject = new Map<string, Anomaly>();
    const rank = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
    for (const a of anomalies) {
      const existing = byProject.get(a.projectId);
      if (!existing || rank[a.reasoning.severity] > rank[existing.reasoning.severity]) {
        byProject.set(a.projectId, a);
      }
    }
    return [...byProject.values()];
  }
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}
