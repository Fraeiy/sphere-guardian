import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureAgentStarted, stopRuntime } from "@/server/runtime";
import { rateLimiter } from "@/infrastructure/utils/rate-limiter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  action: z.enum(["start", "stop", "tick", "report", "purchase"]),
  reportType: z
    .enum(["daily", "weekly", "incident", "health", "recommendations"])
    .optional(),
  incidentId: z.string().optional(),
  serviceKind: z
    .enum([
      "health_report",
      "security_scan",
      "optimization_report",
      "performance_audit",
      "ecosystem_analytics",
    ])
    .optional(),
  requester: z.string().optional(),
});

export async function POST(req: Request) {
  if (!rateLimiter.tryAcquire("api:control", 60, 60_000)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const json = await req.json();
    const body = bodySchema.parse(json);

    if (body.action === "start") {
      const agent = await ensureAgentStarted();
      return NextResponse.json({ ok: true, running: agent.isRunning() });
    }

    if (body.action === "stop") {
      await stopRuntime();
      return NextResponse.json({ ok: true, running: false });
    }

    const agent = await ensureAgentStarted();

    if (body.action === "tick") {
      const state = await agent.forceTick();
      return NextResponse.json({ ok: true, tickCount: state.tickCount });
    }

    if (body.action === "report") {
      const report = await agent.generateReport(
        body.reportType ?? "health",
        body.incidentId
      );
      return NextResponse.json({ ok: true, report });
    }

    if (body.action === "purchase") {
      if (!body.serviceKind) {
        return NextResponse.json(
          { error: "serviceKind required" },
          { status: 400 }
        );
      }
      const request = await agent.purchaseService(
        body.serviceKind,
        body.requester ?? "@external-agent"
      );
      return NextResponse.json({ ok: true, request });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.flatten() },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Control failed" },
      { status: 500 }
    );
  }
}
