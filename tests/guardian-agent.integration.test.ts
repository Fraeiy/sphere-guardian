import { describe, expect, it } from "vitest";
import { GuardianAgent } from "../src/application/agents/guardian-agent";
import { EcosystemHealthEngine } from "../src/application/engines/health-engine";
import { AiDecisionEngine } from "../src/application/engines/decision-engine";
import { NegotiationEngine } from "../src/application/engines/negotiation-engine";
import { AutonomousSettlementEngine } from "../src/application/engines/settlement-engine";
import { createDiagnosticService } from "../src/application/engines/diagnostic-service";
import { NoopAiProvider } from "../src/infrastructure/ai/providers";
import { InProcessEventBus } from "../src/infrastructure/events/event-bus";
import { StructuredLogger } from "../src/infrastructure/logging/logger";
import { MockSphereFacade } from "../src/infrastructure/sphere/mock-sphere";
import { InMemoryRateLimiter } from "../src/infrastructure/utils/rate-limiter";
import type { StateStorePort } from "../src/domain/ports";
import type { ActivityEvent, GuardianStateSnapshot } from "../src/domain/types";

class MemoryStore implements StateStorePort {
  private state: GuardianStateSnapshot | null = null;
  async load() {
    return this.state;
  }
  async save(state: GuardianStateSnapshot) {
    this.state = structuredClone(state);
  }
  async appendActivity(event: ActivityEvent) {
    if (!this.state) return;
    this.state.activity = [event, ...this.state.activity];
  }
}

describe("GuardianAgent integration", () => {
  it("runs full autonomous loop without human approval", async () => {
    process.env.NODE_ENV = "test";
    const ids = {
      generate: (p = "id") =>
        `${p}_${Math.random().toString(16).slice(2, 10)}`,
    };
    const clock = {
      now: () => new Date(),
      nowIso: () => new Date().toISOString(),
      sleep: async () => undefined,
    };
    const sphere = new MockSphereFacade({ nametag: "test-guardian", balance: 100 });
    const agent = new GuardianAgent({
      config: {
        tickIntervalMs: 60_000,
        negotiationWindowMs: 5,
        maxBudgetDefault: 5,
        autoSettle: true,
        maxConcurrentIncidents: 5,
        mode: "mock",
        nametag: "test-guardian",
      },
      sphere,
      health: new EcosystemHealthEngine(
        {
          apiLatencyMs: 100,
          storageUtilizationPct: 50,
          responseTimeMs: 100,
          uptimePctMin: 99.99,
          failureRatePct: 0.01,
          txFailureRatePct: 0.01,
          messagingFailureRatePct: 0.01,
          paymentFailureRatePct: 0.01,
        },
        ids,
        clock,
        { forceAnomalyEvery: 1 }
      ),
      decision: new AiDecisionEngine(new NoopAiProvider(), ids, clock),
      negotiation: new NegotiationEngine(sphere.messaging, ids, clock, {
        mode: "mock",
      }),
      settlement: new AutonomousSettlementEngine(sphere.wallet, ids, clock),
      diagnostics: createDiagnosticService(ids, clock),
      store: new MemoryStore(),
      events: new InProcessEventBus(),
      ids,
      clock,
      logger: new StructuredLogger("test"),
      rateLimiter: new InMemoryRateLimiter(),
    });

    await agent.start();
    // Force several ticks to guarantee anomaly + remediation
    for (let i = 0; i < 3; i++) {
      await agent.forceTick();
    }

    const snap = agent.getSnapshot();
    expect(snap.running).toBe(true);
    expect(snap.identity.connected).toBe(true);
    expect(snap.projects.length).toBeGreaterThan(0);
    expect(snap.activity.some((a) => a.kind === "agent_started")).toBe(true);

    // Should have progressed economic actions when anomalies fire
    const economic = snap.activity.some((a) =>
      [
        "intent_published",
        "provider_selected",
        "payment_settled",
        "issue_resolved",
      ].includes(a.kind)
    );
    expect(economic).toBe(true);
    expect(snap.intents.length + snap.incidents.length).toBeGreaterThan(0);

    // Paid service path
    const req = await agent.purchaseService("health_report", "@buyer");
    expect(req.status).toBe("completed");
    expect(req.reportMarkdown).toContain("Health");

    // Report generation
    const report = await agent.generateReport("daily");
    expect(report.markdown).toContain("Sphere Guardian");

    await agent.stop();
    expect(agent.isRunning()).toBe(false);
  }, 30_000);
});
