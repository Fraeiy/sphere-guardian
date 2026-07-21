"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGuardian } from "@/hooks/use-guardian";

export default function SettingsPage() {
  const { state } = useGuardian();
  if (!state) return null;
  const c = state.config;

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Runtime configuration via environment variables — never hardcode secrets.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Agent</CardTitle>
            <CardDescription>Identity and autonomy controls</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row k="Agent name" v={c.agentName} />
            <Row k="Nametag" v={`@${c.nametag}`} />
            <Row k="Mode" v={c.mode} />
            <Row k="Network" v={c.network} />
            <Row k="Auto settle" v={String(c.autoSettle)} />
            <Row k="Tick interval" v={`${c.tickIntervalMs}ms`} />
            <Row k="Negotiation window" v={`${c.negotiationWindowMs}ms`} />
            <Row k="Default max budget" v={`${c.maxBudgetDefault} ${c.currency}`} />
            <Row k="Max concurrent incidents" v={String(c.maxConcurrentIncidents)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Anomaly thresholds</CardTitle>
            <CardDescription>Health engine breach levels</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {Object.entries(c.anomalyThresholds).map(([k, v]) => (
              <Row key={k} k={k} v={String(v)} />
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Network mode</CardTitle>
            <CardDescription>
              Default is <code className="text-[var(--primary-bright)]">SPHERE_MODE=live</code> on
              Unicity Testnet v2. Use <code className="text-zinc-300">mock</code> only
              for offline CI.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-zinc-400">
            <p>
              Live stack:{" "}
              <Badge tone="accent">Sphere Identity</Badge>{" "}
              <Badge tone="accent">Wallet (UCT)</Badge>{" "}
              <Badge tone="accent">Market intents</Badge>{" "}
              <Badge tone="accent">DMs</Badge>{" "}
              <Badge tone="accent">Peer settlement</Badge>
            </p>
            <p>
              Config: <Badge tone="neutral">GUARDIAN_NAMETAG</Badge>{" "}
              <Badge tone="neutral">GUARDIAN_PEER_NAMETAG</Badge>{" "}
              <Badge tone="neutral">SPHERE_ORACLE_API_KEY</Badge>
            </p>
            <p className="text-xs text-zinc-500">
              Health metrics probe real testnet2 endpoints. A second live peer wallet
              enables true agent-to-agent settlement on-chain.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.04] pb-2">
      <span className="text-zinc-500">{k}</span>
      <span className="font-mono text-xs text-zinc-200">{v}</span>
    </div>
  );
}
