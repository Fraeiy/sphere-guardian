"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGuardian } from "@/hooks/use-guardian";
import { relativeTime, severityColor } from "@/lib/utils";

export default function IncidentsPage() {
  const { state } = useGuardian();
  if (!state) return null;

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Incidents</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Every alert includes AI reasoning, confidence, severity, and impact.
        </p>
      </div>

      <div className="space-y-4">
        {state.incidents.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-zinc-500">
              No incidents yet — the guardian will open one when an anomaly is actionable.
            </CardContent>
          </Card>
        )}
        {state.incidents.map((inc) => (
          <Card key={inc.id}>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{inc.title}</CardTitle>
                <div className="mt-1 text-xs text-zinc-500">
                  {inc.id} · {relativeTime(inc.createdAt)}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge
                  tone={
                    inc.status === "resolved"
                      ? "success"
                      : inc.status === "failed"
                        ? "danger"
                        : "warn"
                  }
                >
                  {inc.status.replace(/_/g, " ")}
                </Badge>
                <span className={`text-xs font-medium uppercase ${severityColor(inc.severity)}`}>
                  {inc.severity}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  AI reasoning
                </div>
                <p className="mt-2 text-zinc-200">{inc.anomaly.reasoning.whyAbnormal}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-zinc-500">Confidence: </span>
                    <span className="text-zinc-200">
                      {(inc.anomaly.reasoning.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Model: </span>
                    <span className="text-zinc-200">
                      {inc.anomaly.reasoning.model ?? "rules"}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-zinc-500">Suggested action: </span>
                    <span className="text-zinc-200">
                      {inc.anomaly.reasoning.suggestedAction}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-zinc-500">Expected impact: </span>
                    <span className="text-zinc-200">
                      {inc.anomaly.reasoning.expectedImpact}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {inc.anomaly.reasoning.evidence.map((e) => (
                    <Badge key={e} tone="neutral">
                      {e}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="grid gap-2 text-xs text-zinc-400 sm:grid-cols-3">
                <div>Intent: {inc.intentId ?? "—"}</div>
                <div>Settlement: {inc.settlementId ?? "—"}</div>
                <div>Diagnostics: {inc.diagnosticId ?? "—"}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
