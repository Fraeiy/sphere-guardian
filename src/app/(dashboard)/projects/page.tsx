"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGuardian } from "@/hooks/use-guardian";
import { formatPct, statusColor } from "@/lib/utils";
import { ExternalLink, Globe, Server } from "lucide-react";
import { useMemo, useState } from "react";

type Filter = "all" | "app" | "infra";

function httpStatusFromTags(tags: string[]): string {
  const hit = tags.find((t) => t.startsWith("http-"));
  if (!hit) return "—";
  if (hit === "http-err") return "ERR";
  return hit.replace("http-", "");
}

export default function ProjectsPage() {
  const { state } = useGuardian();
  const [filter, setFilter] = useState<Filter>("all");

  const allProjects = state?.projects ?? [];

  const projects = useMemo(() => {
    return allProjects.filter((p) => {
      const tags = p.tags ?? [];
      if (filter === "app") return tags.includes("app");
      if (filter === "infra") return tags.includes("infra");
      return true;
    });
  }, [allProjects, filter]);

  const appCount = useMemo(
    () => allProjects.filter((p) => (p.tags ?? []).includes("app")).length,
    [allProjects]
  );
  const infraCount = useMemo(
    () => allProjects.filter((p) => (p.tags ?? []).includes("infra")).length,
    [allProjects]
  );

  if (!state) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
        Loading projects…
      </div>
    );
  }

  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Live HTTP probes only — latency, status code, probe uptime. No fake user counts.
          </p>
        </div>
        <div className="flex gap-2">
          {(
            [
              ["all", `All (${allProjects.length})`],
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
                  ? "bg-[rgba(232,163,23,0.14)] text-[var(--primary-bright)] ring-1 ring-[rgba(232,163,23,0.3)]"
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
          const tags = p.tags ?? [];
          const isApp = tags.includes("app");
          const lastChecked = p.lastCheckedAt
            ? new Date(p.lastCheckedAt).toLocaleTimeString()
            : "—";
          const http = httpStatusFromTags(tags);
          return (
            <Card key={p.id}>
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {isApp ? (
                      <Globe className="h-4 w-4 shrink-0 text-[var(--primary-bright)]" />
                    ) : (
                      <Server className="h-4 w-4 shrink-0 text-[var(--orange)]" />
                    )}
                    <CardTitle className="truncate text-base">{p.name}</CardTitle>
                  </div>
                  {p.url ? (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex max-w-full items-center gap-1 truncate text-xs text-[var(--primary-bright)]/90 hover:text-[var(--primary-bright)]"
                    >
                      <span className="truncate">
                        {p.url.replace(/^https?:\/\//, "")}
                      </span>
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
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <Metric
                    label="Latency"
                    value={`${Math.round(p.apiLatencyMs ?? 0)}ms`}
                  />
                  <Metric label="HTTP" value={http} />
                  <Metric
                    label="Probe uptime"
                    value={formatPct(p.uptimePct ?? 0)}
                  />
                  <Metric
                    label="Probe fail %"
                    value={formatPct(p.failureRatePct ?? 0)}
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {tags
                    .filter(
                      (t) =>
                        !t.startsWith("http-") && t !== "up" && t !== "down"
                    )
                    .slice(0, 6)
                    .map((t) => (
                      <Badge key={t} tone="neutral">
                        {t}
                      </Badge>
                    ))}
                  {tags.includes("up") && <Badge tone="success">up</Badge>}
                  {tags.includes("down") && <Badge tone="danger">down</Badge>}
                </div>
                <div className={`mt-3 text-xs ${statusColor(p.status)}`}>
                  Last probe {lastChecked} · measured via public URL only
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
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-0.5 font-medium text-zinc-200">{value}</div>
    </div>
  );
}
