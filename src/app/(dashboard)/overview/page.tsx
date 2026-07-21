"use client";

import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { LatencyChart } from "@/components/dashboard/metrics-chart";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGuardian } from "@/hooks/use-guardian";
import { formatNumber, statusColor } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  Bot,
  Server,
  Wallet,
  Zap,
} from "lucide-react";

export default function OverviewPage() {
  const { state } = useGuardian();
  if (!state) return null;

  const openIncidents = state.incidents.filter(
    (i) => !["resolved", "failed", "cancelled"].includes(i.status)
  ).length;
  const healthy = state.projects.filter((p) => p.status === "healthy").length;
  const latest = state.metrics.find((m) => !m.projectId);

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Overview
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Autonomous network operations across the Unicity Sphere ecosystem.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Wallet balance"
          value={`${formatNumber(state.walletBalance, 2)} ${state.walletCurrency}`}
          hint={state.identity.mode === "live" ? "Sphere Wallet (live)" : "Mock wallet"}
          icon={Wallet}
          accent="gold"
        />
        <StatCard
          label="Open incidents"
          value={String(openIncidents)}
          hint={`${state.incidents.filter((i) => i.status === "resolved").length} resolved`}
          icon={AlertTriangle}
          accent="crimson"
        />
        <StatCard
          label="Healthy projects"
          value={`${healthy}/${state.projects.length}`}
          hint={`Avg latency ${latest ? Math.round(latest.latencyMs) : "—"}ms`}
          icon={Server}
          accent="emerald"
        />
        <StatCard
          label="Targets up"
          value={`${state.projects.filter((p) => p.status === "healthy").length}/${state.projects.length || 0}`}
          hint="From live URL probes (not analytics users)"
          icon={Bot}
          accent="orange"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Ecosystem latency</CardTitle>
            <CardDescription>Real-time aggregate API latency (ms)</CardDescription>
          </CardHeader>
          <CardContent>
            <LatencyChart metrics={state.metrics} />
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Apps</CardTitle>
            <CardDescription>Live URL latency (real probes)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.projects
              .filter((p) => p.tags.includes("app"))
              .slice(0, 7)
              .map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-zinc-200">
                    {p.name}
                  </div>
                  <div className="truncate text-[11px] text-zinc-500">
                    {Math.round(p.apiLatencyMs)}ms
                    {p.url ? (
                      <>
                        {" · "}
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--primary-bright)] hover:text-[var(--primary)]"
                        >
                          {p.url.replace(/^https?:\/\//, "")}
                        </a>
                      </>
                    ) : null}
                  </div>
                </div>
                <span className={`text-xs font-medium capitalize ${statusColor(p.status)}`}>
                  {p.status}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Activity timeline</CardTitle>
              <CardDescription>Every autonomous decision</CardDescription>
            </div>
            <Badge tone="accent">
              <Activity className="mr-1 h-3 w-3" />
              live
            </Badge>
          </CardHeader>
          <CardContent>
            <ActivityFeed events={state.activity.slice(0, 12)} />
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Identity & economy</CardTitle>
            <CardDescription>Sphere integration surface</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Row label="Mode" value={state.identity.mode} />
            <Row label="Network" value={state.identity.network} />
            <Row label="Nametag" value={state.identity.nametag ? `@${state.identity.nametag}` : "—"} />
            <Row
              label="Address"
              value={
                state.identity.directAddress
                  ? `${state.identity.directAddress.slice(0, 22)}…`
                  : "—"
              }
            />
            <Row label="Intents published" value={String(state.intents.length)} />
            <Row label="Settlements" value={String(state.settlements.length)} />
            <Row label="Service sales" value={String(state.serviceRequests.length)} />
            <div className="flex items-center gap-2 rounded-xl border border-[rgba(232,163,23,0.25)] bg-[rgba(232,163,23,0.08)] px-3 py-2.5 text-xs text-[#f5d78e]">
              <Zap className="h-4 w-4 text-[var(--primary)]" />
              No manual approval after startup — full M2M loop.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.04] pb-2">
      <span className="text-zinc-500">{label}</span>
      <span className="truncate font-medium text-zinc-200">{value}</span>
    </div>
  );
}
