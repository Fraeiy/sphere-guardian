import type { GuardianConfig, ServiceListing } from "./types";

const DEFAULT_CURRENCY = process.env.GUARDIAN_CURRENCY ?? "UCT";

export const DEFAULT_SERVICE_CATALOG: ServiceListing[] = [
  {
    kind: "health_report",
    name: "Ecosystem Health Report",
    description:
      "Full multi-project health snapshot with latency, uptime, and failure analysis.",
    price: 2,
    currency: DEFAULT_CURRENCY,
    estimatedMs: 8_000,
    available: true,
  },
  {
    kind: "security_scan",
    name: "Security Scan",
    description:
      "Agent-facing security posture check covering auth surfaces, payment paths, and messaging exposure.",
    price: 4,
    currency: DEFAULT_CURRENCY,
    estimatedMs: 15_000,
    available: true,
  },
  {
    kind: "optimization_report",
    name: "Optimization Report",
    description:
      "Cost and performance optimization recommendations for Sphere-connected applications.",
    price: 3,
    currency: DEFAULT_CURRENCY,
    estimatedMs: 12_000,
    available: true,
  },
  {
    kind: "performance_audit",
    name: "Performance Audit",
    description:
      "Deep dive into API latency, storage utilization, and transaction throughput.",
    price: 3.5,
    currency: DEFAULT_CURRENCY,
    estimatedMs: 14_000,
    available: true,
  },
  {
    kind: "ecosystem_analytics",
    name: "Ecosystem Analytics",
    description:
      "Cross-agent market analytics: intent volume, settlement rates, and active agent density.",
    price: 5,
    currency: DEFAULT_CURRENCY,
    estimatedMs: 10_000,
    available: true,
  },
];

export const DEFAULT_CONFIG: GuardianConfig = {
  agentName: "Sphere Guardian AI",
  nametag: process.env.GUARDIAN_NAMETAG ?? "sphere-guardian",
  // Live Testnet v2 is the default. Set SPHERE_MODE=mock only for offline CI.
  mode: (process.env.SPHERE_MODE as "mock" | "live") ?? "live",
  network: process.env.SPHERE_NETWORK ?? "testnet2",
  tickIntervalMs: Number(process.env.GUARDIAN_TICK_MS ?? 12_000),
  negotiationWindowMs: Number(process.env.GUARDIAN_NEGOTIATION_MS ?? 8_000),
  maxBudgetDefault: Number(process.env.GUARDIAN_MAX_BUDGET ?? 5),
  currency: DEFAULT_CURRENCY,
  autoSettle: true,
  maxConcurrentIncidents: Number(process.env.GUARDIAN_MAX_INCIDENTS ?? 5),
  anomalyThresholds: {
    apiLatencyMs: Number(process.env.THRESHOLD_API_LATENCY_MS ?? 1500),
    storageUtilizationPct: 85,
    responseTimeMs: Number(process.env.THRESHOLD_RESPONSE_MS ?? 2000),
    uptimePctMin: Number(process.env.THRESHOLD_UPTIME_MIN ?? 97),
    failureRatePct: Number(process.env.THRESHOLD_FAILURE_PCT ?? 15),
    txFailureRatePct: 10,
    messagingFailureRatePct: 10,
    paymentFailureRatePct: 10,
  },
  serviceCatalog: DEFAULT_SERVICE_CATALOG,
};

export function resolveConfig(
  overrides: Partial<GuardianConfig> = {}
): GuardianConfig {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    anomalyThresholds: {
      ...DEFAULT_CONFIG.anomalyThresholds,
      ...overrides.anomalyThresholds,
    },
    serviceCatalog: overrides.serviceCatalog ?? DEFAULT_CONFIG.serviceCatalog,
  };
}
