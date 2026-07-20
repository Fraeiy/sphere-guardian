"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGuardian } from "@/hooks/use-guardian";
import { relativeTime } from "@/lib/utils";

export default function MarketplacePage() {
  const { state } = useGuardian();
  if (!state) return null;

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Marketplace</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Intent Market publications and negotiation offers from peer agents.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Published intents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.intents.length === 0 && (
              <p className="text-sm text-zinc-500">No intents published yet.</p>
            )}
            {state.intents.map((intent) => (
              <div
                key={intent.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="accent">{intent.intentType}</Badge>
                  <Badge tone="neutral">{intent.status}</Badge>
                  <Badge tone="warn">
                    max {intent.maxBudget} {intent.currency}
                  </Badge>
                  <Badge tone="info">{intent.priority}</Badge>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                  {intent.description}
                </p>
                <div className="mt-2 text-[11px] text-zinc-600">
                  {intent.sphereIntentId ?? intent.id}
                  {intent.publishedAt ? ` · ${relativeTime(intent.publishedAt)}` : ""}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Offers received</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.offers.length === 0 && (
              <p className="text-sm text-zinc-500">No offers yet.</p>
            )}
            {state.offers.map((o) => (
              <div
                key={o.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-zinc-100">
                    @{o.agentNametag}
                  </span>
                  <span className="text-sm text-cyan-300">
                    {o.price} {o.currency}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-400">{o.message}</p>
                <div className="mt-2 flex gap-3 text-[11px] text-zinc-500">
                  <span>ETA {(o.estimatedCompletionMs / 1000).toFixed(0)}s</span>
                  <span>reliability {(o.reliabilityScore * 100).toFixed(0)}%</span>
                  <span>{relativeTime(o.receivedAt)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
