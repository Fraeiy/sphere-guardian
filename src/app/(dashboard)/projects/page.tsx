"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGuardian } from "@/hooks/use-guardian";
import { formatPct, statusColor } from "@/lib/utils";
import { ExternalLink, Globe, Server } from "lucide-react";
import { useMemo, useState } from "react";

type Filter = "all" | "app" | "infra";

export default function ProjectsPage() {
  const { state } = useGuardian();
  const [filter, setFilter] = useState<Filter>("all");
  if (!state) return null;

  const projects = useMemo(() => {
    return state.projects.filter((p) => {
      if (filter === "app") return p.tags.includes("app");
      if (filter === "infra") return p.tags.includes("infra");
      return true;
    });
  }, [state.projects, filter]);

  const appCount = state.projects.filter((p) => p.tags.includes("app")).length;
  const infraCount = state.projects.filter((p) => p.tags.includes("infra")).length;

  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Live URL probes — product apps and Unicity infrastructure.
          </p>
        </div>
        <div className="flex gap-2">
          {(
            [
              ["all", `All (${state.projects.length})`],
              ["app", `Apps (${appCount})`],
              ["infra", `Infra (${infraCount})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === key
                  ? "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/30"
                  : "bg-white/[0.03] text-zinc-400 ring-1 ring-white/[0.06] hover:text-zinc-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {projects.length === 0 && (
          <Card className="lg:col-span-2">
            <CardContent className="py-12 text-center text-sm text-zinc-500">
              Waiting for first probe cycle…
            </CardContent>
          </Card>
        )}
        {projects.map((p) => {
          const isApp = p.tags.includes("app");
          return (
            <Card key={p.id}>
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {isApp ? (
                      <Globe className="h-4 w-4 shrink-0 text-cyan-300" />
                    ) : (
                      <Server className="h-4 w-4 shrink-0 text-violet-300" />
                    )}
                    <CardTitle className="truncate text-base">{p.name}</CardTitle>
                  </div>
                  {p.url ? (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex max-w-full items-center gap-1 truncate text-xs text-cyan-300/90 hover:text-cyan-200"
                    >
                      <span className="truncate">{p.url.replace(/^https?:\/\//, "")}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  ) : (
                    <div className="mt-1 text-xs text-zinc-500">{p.slug}</div>
                  )}
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
                  <Metric label="Latency" value={`${Math.round(p.apiLatencyMs)}ms`} />
                  <Metric label="Response" value={`${Math.round(p.responseTimeMs)}ms`} />
                  <Metric label="Uptime" value={formatPct(p.uptimePct)} />
                  <Metric label="Failures" value={formatPct(p.failureRatePct)} />
                  <Metric label="Users (est.)" value={String(p.activeUsers)} />
                  <Metric label="Agents (est.)" value={String(p.activeAgents)} />
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {p.tags
                    .filter((t) => !t.startsWith("http-"))
                    .slice(0, 8)
                    .map((t) => (
                      <Badge key={t} tone={t === "up" ? "success" : t === "down" ? "danger" : "neutral"}>
                        {t}
                      </Badge>
                    ))}
                </div>
                <div className={`mt-3 text-xs ${statusColor(p.status)}`}>
                  Last checked {new Date(p.lastCheckedAt).toLocaleTimeString()}
                </div>
              </CardContent>
            </Card>
          );
        })}
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
