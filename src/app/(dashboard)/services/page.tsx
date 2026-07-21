"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGuardian } from "@/hooks/use-guardian";
import type { ServiceKind } from "@/domain/types";
import { relativeTime } from "@/lib/utils";
import { useState } from "react";

export default function ServicesPage() {
  const { state, refresh } = useGuardian();
  const [busy, setBusy] = useState<string | null>(null);
  if (!state) return null;

  const purchase = async (kind: ServiceKind) => {
    setBusy(kind);
    try {
      await fetch("/api/guardian/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "purchase",
          serviceKind: kind,
          requester: "@demo-buyer-agent",
        }),
      });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agent Services</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Guardian publishes paid diagnostics other agents can purchase on Sphere.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {state.config.serviceCatalog.map((s) => (
          <Card key={s.kind}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{s.name}</CardTitle>
                <Badge tone={s.available ? "success" : "neutral"}>
                  {s.available ? "available" : "offline"}
                </Badge>
              </div>
              <CardDescription>{s.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-2xl font-semibold text-[var(--primary-bright)]">
                    {s.price}{" "}
                    <span className="text-sm font-normal text-zinc-400">
                      {s.currency}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    ~{(s.estimatedMs / 1000).toFixed(0)}s fulfillment
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={!s.available || busy === s.kind}
                  onClick={() => purchase(s.kind)}
                >
                  {busy === s.kind ? "Fulfilling…" : "Simulate purchase"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Service request history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {state.serviceRequests.length === 0 && (
            <p className="text-sm text-zinc-500">No inbound purchases yet.</p>
          )}
          {state.serviceRequests.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium text-zinc-100">
                  {r.kind.replace(/_/g, " ")} · {r.requester}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="success">
                    +{r.price} {r.currency}
                  </Badge>
                  <Badge tone="neutral">{r.status}</Badge>
                  <span className="text-[11px] text-zinc-600">
                    {relativeTime(r.createdAt)}
                  </span>
                </div>
              </div>
              {r.reportMarkdown && (
                <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-black/40 p-3 text-[11px] leading-relaxed text-zinc-400">
                  {r.reportMarkdown.slice(0, 800)}
                </pre>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
