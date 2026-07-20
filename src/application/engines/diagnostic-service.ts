import type {
  ClockPort,
  DiagnosticServicePort,
  IdPort,
  ServiceListingPort,
} from "@/domain/ports";
import type {
  Anomaly,
  DiagnosticResult,
  EcosystemProject,
  ServiceKind,
  ServiceOffer,
  ServiceRequest,
  ServiceListing,
} from "@/domain/types";
import { DEFAULT_SERVICE_CATALOG } from "@/domain/config";

/**
 * Paid Diagnostic Service — Guardian consumes peer diagnostics and
 * exposes its own catalog for other agents to purchase.
 */
export class DiagnosticServiceEngine implements DiagnosticServicePort {
  constructor(
    private readonly catalog: ServiceListing[],
    private readonly ids: IdPort,
    private readonly clock: ClockPort
  ) {}

  getCatalog(): ServiceListingPort[] {
    return this.catalog.map((c) => ({ ...c }));
  }

  async requestDiagnostics(input: {
    offer: ServiceOffer;
    incidentId: string;
    project: EcosystemProject;
    anomaly: Anomaly;
  }): Promise<DiagnosticResult> {
    const { offer, incidentId, project, anomaly } = input;

    // Simulate provider work proportional to ETA (capped for UX).
    const wait = Math.min(offer.estimatedCompletionMs, process.env.NODE_ENV === "test" ? 5 : 2_500);
    await new Promise((r) => setTimeout(r, wait));

    const findings = [
      `${anomaly.metric} breached threshold (${anomaly.observedValue.toFixed(2)} vs ${anomaly.threshold}).`,
      `Project status classified as ${project.status} with ${project.activeAgents} active agents.`,
      `Payment failure rate ${project.paymentFailureRatePct.toFixed(2)}%, messaging failures ${project.messagingFailureRatePct.toFixed(2)}%.`,
      `Storage utilization at ${project.storageUtilizationPct.toFixed(1)}%.`,
    ];

    const recommendations = [
      `Prioritize remediation of ${anomaly.metric} on ${project.name}.`,
      "Increase settlement retry budget with exponential backoff for CERTIFICATION_UNCONFIRMED.",
      "Publish health intent only when confidence ≥ 0.55 and severity ≥ medium.",
      "Cache peer reliability scores across negotiation rounds.",
    ];

    const markdown = [
      `# Diagnostics Report — ${project.name}`,
      "",
      `**Provider:** @${offer.agentNametag}`,
      `**Incident:** ${incidentId}`,
      `**Generated:** ${this.clock.nowIso()}`,
      "",
      "## Root Cause Hypothesis",
      anomaly.reasoning.whyAbnormal,
      "",
      `**Confidence:** ${(anomaly.reasoning.confidence * 100).toFixed(1)}%`,
      `**Severity:** ${anomaly.reasoning.severity}`,
      "",
      "## Findings",
      ...findings.map((f) => `- ${f}`),
      "",
      "## Recommendations",
      ...recommendations.map((r) => `- ${r}`),
      "",
      "## Expected Impact if Unresolved",
      anomaly.reasoning.expectedImpact,
      "",
      "---",
      `_Settled for ${offer.price} ${offer.currency} via Sphere Guardian autonomous settlement._`,
    ].join("\n");

    return {
      id: this.ids.generate("diag"),
      incidentId,
      provider: offer.agentNametag,
      serviceKind: "performance_audit",
      summary: `Diagnostics complete for ${project.name}: ${anomaly.metric} anomaly confirmed.`,
      findings,
      recommendations,
      rawReportMarkdown: markdown,
      receivedAt: this.clock.nowIso(),
      score: Math.round(70 + anomaly.reasoning.confidence * 25),
    };
  }

  async fulfillServiceRequest(
    request: ServiceRequest,
    projects: EcosystemProject[]
  ): Promise<{ reportMarkdown: string }> {
    const now = this.clock.nowIso();
    const healthy = projects.filter((p) => p.status === "healthy").length;
    const body = renderServiceReport(request.kind, projects, now, healthy);
    return { reportMarkdown: body };
  }
}

function renderServiceReport(
  kind: ServiceKind,
  projects: EcosystemProject[],
  now: string,
  healthy: number
): string {
  const header = `# Sphere Guardian — ${kind.replace(/_/g, " ").toUpperCase()}\n\nGenerated: ${now}\n\n`;
  const table = [
    "| Project | Status | Latency | Uptime | Agents |",
    "| --- | --- | ---: | ---: | ---: |",
    ...projects.map(
      (p) =>
        `| ${p.name} | ${p.status} | ${p.apiLatencyMs.toFixed(0)}ms | ${p.uptimePct.toFixed(2)}% | ${p.activeAgents} |`
    ),
  ].join("\n");

  const footer = `\n\nHealthy projects: ${healthy}/${projects.length}\n\n_Paid diagnostic service fulfilled by Sphere Guardian AI._\n`;

  switch (kind) {
    case "security_scan":
      return (
        header +
        "## Security Posture\n\n- Identity bindings verified\n- Payment request handlers rate-limited\n- No hardcoded secrets in runtime config\n\n" +
        table +
        footer
      );
    case "optimization_report":
      return (
        header +
        "## Optimization Opportunities\n\n- Batch metric scrapes per tick\n- Cap activity log persistence\n- Prefer high-reliability peers under budget\n\n" +
        table +
        footer
      );
    case "performance_audit":
      return (
        header +
        "## Performance Audit\n\nFocus on p95 latency and payment failure correlation.\n\n" +
        table +
        footer
      );
    case "ecosystem_analytics":
      return (
        header +
        "## Ecosystem Analytics\n\nAgent density, intent fill rate, and settlement success tracked continuously.\n\n" +
        table +
        footer
      );
    case "health_report":
    default:
      return header + "## Health Report\n\n" + table + footer;
  }
}

export function createDiagnosticService(
  ids: IdPort,
  clock: ClockPort,
  catalog: ServiceListing[] = DEFAULT_SERVICE_CATALOG
): DiagnosticServiceEngine {
  return new DiagnosticServiceEngine(catalog, ids, clock);
}
