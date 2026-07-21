"use client";

import {
  LatencyChart,
  MultiMetricChart,
} from "@/components/dashboard/metrics-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGuardian } from "@/hooks/use-guardian";
import { useState } from "react";

export default function AnalyticsPage() {
  const { state, refresh } = useGuardian();
  const [busy, setBusy] = useState(false);
  if (!state) return null;

  const generate = async (reportType: string) => {
    setBusy(true);
    try {
      await fetch("/api/guardian/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "report", reportType }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Latency, usage, payments, transactions, incidents, agents, service requests.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["daily", "weekly", "health", "recommendations"] as const).map((t) => (
            <Button
              key={t}
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => generate(t)}
            >
              {t} report
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Latency</CardTitle>
            <CardDescription>Aggregate API latency over ticks</CardDescription>
          </CardHeader>
          <CardContent>
            <LatencyChart metrics={state.metrics} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Probe & market multi-series</CardTitle>
            <CardDescription>
              Healthy targets · probed count · unhealthy · market intents · market agents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MultiMetricChart metrics={state.metrics} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI reports (Markdown export)</CardTitle>
          <CardDescription>Downloadable operational intelligence</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {state.reports.length === 0 && (
            <p className="text-sm text-zinc-500">Generate a report to get started.</p>
          )}
          {state.reports.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
            >
              <div>
                <div className="text-sm font-medium text-zinc-100">{r.title}</div>
                <div className="text-xs text-zinc-500">
                  {r.type} · {new Date(r.createdAt).toLocaleString()}
                </div>
              </div>
              <a
                className="text-sm text-cyan-300 hover:text-cyan-200"
                href={`/api/reports/${r.id}`}
              >
                Export .md
              </a>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
