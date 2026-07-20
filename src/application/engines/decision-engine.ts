import type {
  AiProviderPort,
  ClockPort,
  DecisionContext,
  DecisionEnginePort,
  IdPort,
  ReportContext,
} from "@/domain/ports";
import type {
  Anomaly,
  AiReport,
  DecisionReasoning,
  GuardianConfig,
} from "@/domain/types";

/**
 * AI Decision Engine — always produces structured reasoning.
 * Uses optional LLM provider when available; falls back to deterministic
 * expert rules so the agent never blocks on model availability.
 */
export class AiDecisionEngine implements DecisionEnginePort {
  constructor(
    private readonly ai: AiProviderPort,
    private readonly ids: IdPort,
    private readonly clock: ClockPort
  ) {}

  async analyze(
    anomaly: Anomaly,
    context: DecisionContext
  ): Promise<DecisionReasoning> {
    const base = { ...anomaly.reasoning };

    if (!this.ai.isAvailable()) {
      return {
        ...base,
        confidence: clamp(
          base.confidence + (context.walletBalance > 0 ? 0.02 : -0.05),
          0.5,
          0.98
        ),
        evidence: [
          ...base.evidence,
          `open_pressure=${context.recentIncidents}`,
          `wallet_balance=${context.walletBalance}`,
          "provider=rules",
        ],
        model: "guardian-rules-v1",
      };
    }

    try {
      const { text, model } = await this.ai.complete({
        system: `You are Sphere Guardian AI, an autonomous network operations agent for Unicity Sphere.
Return a concise JSON object with keys: whyAbnormal, confidence (0-1), suggestedAction, severity (info|low|medium|high|critical), expectedImpact, evidence (string array).`,
        prompt: JSON.stringify({
          anomaly,
          projects: context.projects.map((p) => ({
            name: p.name,
            status: p.status,
            latency: p.apiLatencyMs,
            uptime: p.uptimePct,
          })),
          recentIncidents: context.recentIncidents,
          walletBalance: context.walletBalance,
        }),
        temperature: 0.2,
      });

      const parsed = extractJson(text);
      if (!parsed) return { ...base, model };

      return {
        whyAbnormal: String(parsed.whyAbnormal ?? base.whyAbnormal),
        confidence: clamp(Number(parsed.confidence ?? base.confidence), 0, 1),
        suggestedAction: String(parsed.suggestedAction ?? base.suggestedAction),
        severity: (parsed.severity as DecisionReasoning["severity"]) ?? base.severity,
        expectedImpact: String(parsed.expectedImpact ?? base.expectedImpact),
        evidence: Array.isArray(parsed.evidence)
          ? parsed.evidence.map(String)
          : base.evidence,
        model,
      };
    } catch {
      return { ...base, model: "guardian-rules-v1-fallback" };
    }
  }

  shouldAct(reasoning: DecisionReasoning, config: GuardianConfig): boolean {
    if (!config.autoSettle) return false;
    if (reasoning.confidence < 0.55) return false;
    return (
      reasoning.severity === "medium" ||
      reasoning.severity === "high" ||
      reasoning.severity === "critical"
    );
  }

  async summarizeIncident(input: ReportContext): Promise<string> {
    const incident = input.incidents.find((i) => i.id === input.incidentId);
    if (!incident) return "Incident not found.";
    return [
      `# Incident Summary — ${incident.title}`,
      "",
      `- **Status:** ${incident.status}`,
      `- **Severity:** ${incident.severity}`,
      `- **Project:** ${incident.projectName}`,
      `- **Detected:** ${incident.createdAt}`,
      `- **Metric:** ${incident.anomaly.metric} = ${incident.anomaly.observedValue}`,
      "",
      "## Reasoning",
      incident.anomaly.reasoning.whyAbnormal,
      "",
      `**Suggested action:** ${incident.anomaly.reasoning.suggestedAction}`,
      `**Expected impact:** ${incident.anomaly.reasoning.expectedImpact}`,
      `**Confidence:** ${(incident.anomaly.reasoning.confidence * 100).toFixed(1)}%`,
    ].join("\n");
  }

  async generateReport(input: ReportContext): Promise<AiReport> {
    const healthy = input.projects.filter((p) => p.status === "healthy").length;
    const degraded = input.projects.filter((p) => p.status === "degraded").length;
    const unhealthy = input.projects.filter((p) => p.status === "unhealthy").length;
    const openIncidents = input.incidents.filter((i) => i.status !== "resolved").length;
    const resolved = input.incidents.filter((i) => i.status === "resolved").length;
    const latest = input.metrics.find((m) => !m.projectId);

    const lines = [
      `# Sphere Guardian — ${titleFor(input.type)}`,
      "",
      `**Period:** ${input.periodStart} → ${input.periodEnd}`,
      `**Generated:** ${this.clock.nowIso()}`,
      "",
      "## Ecosystem Snapshot",
      "",
      `| Status | Count |`,
      `| --- | ---: |`,
      `| Healthy | ${healthy} |`,
      `| Degraded | ${degraded} |`,
      `| Unhealthy | ${unhealthy} |`,
      "",
      "## Operations",
      "",
      `- Open incidents: **${openIncidents}**`,
      `- Resolved incidents: **${resolved}**`,
      `- Aggregate latency: **${latest ? latest.latencyMs.toFixed(0) : "n/a"} ms**`,
      `- Active agents: **${latest?.activeAgents ?? "n/a"}**`,
      `- Service requests: **${latest?.serviceRequests ?? "n/a"}**`,
      "",
      "## Projects",
      "",
      ...input.projects.map(
        (p) =>
          `- **${p.name}** — ${p.status} · latency ${p.apiLatencyMs.toFixed(0)}ms · uptime ${p.uptimePct.toFixed(2)}% · agents ${p.activeAgents}`
      ),
      "",
      "## Recommendations",
      "",
      ...buildRecommendations(input),
      "",
      "## Recent Autonomous Actions",
      "",
      ...input.activity.slice(0, 12).map(
        (a) => `- \`${a.timestamp}\` **${a.title}** — ${a.detail}`
      ),
      "",
      "---",
      "_Generated by Sphere Guardian AI — Autonomous Network Operations Agent_",
    ];

    if (this.ai.isAvailable()) {
      try {
        const { text } = await this.ai.complete({
          system: "You enhance operations reports. Append a short executive summary paragraph.",
          prompt: lines.join("\n"),
          temperature: 0.3,
        });
        lines.splice(5, 0, "", "## Executive Summary", "", text.trim(), "");
      } catch {
        /* keep deterministic report */
      }
    }

    return {
      id: this.ids.generate("report"),
      type: input.type,
      title: titleFor(input.type),
      markdown: lines.join("\n"),
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      createdAt: this.clock.nowIso(),
      incidentId: input.incidentId,
    };
  }
}

function titleFor(type: AiReport["type"]): string {
  switch (type) {
    case "daily":
      return "Daily Operations Report";
    case "weekly":
      return "Weekly Ecosystem Report";
    case "incident":
      return "Incident Summary";
    case "health":
      return "Health Summary";
    case "recommendations":
      return "Recommendations";
  }
}

function buildRecommendations(input: ReportContext): string[] {
  const recs: string[] = [];
  for (const p of input.projects) {
    if (p.apiLatencyMs > 800) {
      recs.push(`- Scale read path for **${p.name}** (latency ${p.apiLatencyMs.toFixed(0)}ms).`);
    }
    if (p.storageUtilizationPct > 80) {
      recs.push(`- Expand storage capacity for **${p.name}** (${p.storageUtilizationPct.toFixed(1)}% used).`);
    }
    if (p.paymentFailureRatePct > 1.5) {
      recs.push(`- Audit payment settlement path on **${p.name}**.`);
    }
  }
  if (!recs.length) {
    recs.push("- No critical remediation required. Continue autonomous monitoring.");
    recs.push("- Keep max diagnostic budget and negotiation windows tuned to agent density.");
  }
  return recs.slice(0, 8);
}

function extractJson(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
