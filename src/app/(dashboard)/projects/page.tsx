"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGuardian } from "@/hooks/use-guardian";
import { formatPct, statusColor } from "@/lib/utils";

export default function ProjectsPage() {
  const { state } = useGuardian();
  if (!state) return null;

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Deployed Sphere applications monitored by the health engine.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {state.projects.map((p) => (
          <Card key={p.id}>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{p.name}</CardTitle>
                <div className="mt-1 text-xs text-zinc-500">{p.slug}</div>
              </div>
              <Badge
                tone={
                  p.status === "healthy"
                    ? "success"
                    : p.status === "degraded"
                      ? "warn"
                      : "danger"
                }
              >
                {p.status}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <Metric label="API latency" value={`${Math.round(p.apiLatencyMs)}ms`} />
                <Metric label="Response" value={`${Math.round(p.responseTimeMs)}ms`} />
                <Metric label="Uptime" value={formatPct(p.uptimePct)} />
                <Metric label="Storage" value={formatPct(p.storageUtilizationPct)} />
                <Metric label="Failures" value={formatPct(p.failureRatePct)} />
                <Metric label="Tx fail" value={formatPct(p.txFailureRatePct)} />
                <Metric label="Msg fail" value={formatPct(p.messagingFailureRatePct)} />
                <Metric label="Pay fail" value={formatPct(p.paymentFailureRatePct)} />
                <Metric label="Users" value={String(p.activeUsers)} />
                <Metric label="Agents" value={String(p.activeAgents)} />
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {p.tags.map((t) => (
                  <Badge key={t} tone="neutral">
                    {t}
                  </Badge>
                ))}
              </div>
              <div className={`mt-3 text-xs capitalize ${statusColor(p.status)}`}>
                Last checked {new Date(p.lastCheckedAt).toLocaleTimeString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.02] px-2.5 py-2 ring-1 ring-white/[0.04]">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-0.5 font-medium text-zinc-200">{value}</div>
    </div>
  );
}
