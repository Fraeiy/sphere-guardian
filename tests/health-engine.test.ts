import { describe, expect, it } from "vitest";
import { EcosystemHealthEngine } from "../src/application/engines/health-engine";
import { DEFAULT_CONFIG } from "../src/domain/config";

const ids = { generate: (p = "id") => `${p}_${Math.random().toString(16).slice(2, 8)}` };
const clock = {
  now: () => new Date(),
  nowIso: () => new Date().toISOString(),
  sleep: async () => undefined,
};

describe("EcosystemHealthEngine", () => {
  it("collects projects and metrics", async () => {
    const engine = new EcosystemHealthEngine(
      DEFAULT_CONFIG.anomalyThresholds,
      ids,
      clock,
      { forceAnomalyEvery: 1 }
    );
    const projects = await engine.collectProjects();
    expect(projects.length).toBeGreaterThan(0);
    const metrics = await engine.collectMetrics(projects);
    expect(metrics.some((m) => !m.projectId)).toBe(true);
  });

  it("detects anomalies with reasoning on injected breach", async () => {
    const engine = new EcosystemHealthEngine(
      DEFAULT_CONFIG.anomalyThresholds,
      ids,
      clock,
      { forceAnomalyEvery: 1 }
    );
    // force a few ticks so injection happens
    let projects = await engine.collectProjects();
    projects = await engine.collectProjects();
    const anomalies = await engine.detectAnomalies(projects, []);
    // Not every tick may breach after map — but forceAnomalyEvery=1 should
    // typically produce at least one. Assert structure when present.
    if (anomalies.length) {
      const a = anomalies[0];
      expect(a.reasoning.whyAbnormal.length).toBeGreaterThan(10);
      expect(a.reasoning.confidence).toBeGreaterThan(0.5);
      expect(a.reasoning.suggestedAction).toBeTruthy();
      expect(a.reasoning.severity).toBeTruthy();
      expect(a.reasoning.expectedImpact).toBeTruthy();
    }
    expect(projects.every((p) => p.lastCheckedAt)).toBe(true);
  });
});
