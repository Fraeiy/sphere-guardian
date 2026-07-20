import { describe, expect, it } from "vitest";
import { NegotiationEngine } from "../src/application/engines/negotiation-engine";
import type { GuardianIntent, ServiceOffer } from "../src/domain/types";
import type { SphereMessagingPort } from "../src/domain/ports";

const messaging: SphereMessagingPort = {
  send: async (peer, content, payload) => ({
    id: "m1",
    direction: "outbound",
    peer,
    kind: "negotiation",
    content,
    payload,
    timestamp: new Date().toISOString(),
    read: true,
  }),
  onMessage: () => () => undefined,
};

const ids = { generate: (p = "id") => `${p}_test` };
const clock = {
  now: () => new Date(),
  nowIso: () => new Date().toISOString(),
  sleep: async () => undefined,
};

describe("NegotiationEngine", () => {
  it("scores offers and prefers reliable under-budget peers", () => {
    const engine = new NegotiationEngine(messaging, ids, clock, { mode: "mock" });
    const offers: ServiceOffer[] = [
      {
        id: "a",
        intentId: "i1",
        agentId: "1",
        agentNametag: "cheap-slow",
        price: 1,
        currency: "TEST",
        estimatedCompletionMs: 30_000,
        reliabilityScore: 0.6,
        message: "cheap",
        receivedAt: new Date().toISOString(),
      },
      {
        id: "b",
        intentId: "i1",
        agentId: "2",
        agentNametag: "premium",
        price: 4,
        currency: "TEST",
        estimatedCompletionMs: 5_000,
        reliabilityScore: 0.97,
        message: "fast reliable",
        receivedAt: new Date().toISOString(),
      },
      {
        id: "c",
        intentId: "i1",
        agentId: "3",
        agentNametag: "overbudget",
        price: 9,
        currency: "TEST",
        estimatedCompletionMs: 3_000,
        reliabilityScore: 0.99,
        message: "too expensive",
        receivedAt: new Date().toISOString(),
      },
    ];

    const scores = engine.scoreOffers(offers, 5);
    const best = engine.selectBest(scores, offers);
    expect(best).not.toBeNull();
    expect(best!.id).toBe("b");
    const over = scores.find((s) => s.offerId === "c");
    expect(over!.totalScore).toBeLessThan(
      scores.find((s) => s.offerId === "b")!.totalScore
    );
  });

  it("solicits multiple offers within budget window", async () => {
    process.env.NODE_ENV = "test";
    const engine = new NegotiationEngine(messaging, ids, clock, { mode: "mock" });
    const intent: GuardianIntent = {
      id: "intent_1",
      incidentId: "inc_1",
      description: "Need diagnostics for App X",
      intentType: "service",
      category: "diagnostics",
      maxBudget: 5,
      currency: "TEST",
      priority: "high",
      status: "published",
      metadata: { projectName: "App X" },
    };
    const offers = await engine.solicitOffers(intent, 10);
    expect(offers.length).toBeGreaterThanOrEqual(3);
    expect(offers.every((o) => o.currency === "TEST")).toBe(true);
  });
});
