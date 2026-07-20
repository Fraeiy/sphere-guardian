"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GuardianStateSnapshot } from "@/domain/types";
import { formatNumber } from "@/lib/utils";
import { Pause, Play, RefreshCw, Radio } from "lucide-react";

export function Topbar({
  state,
  onStart,
  onStop,
  onTick,
}: {
  state: GuardianStateSnapshot | null;
  onStart: () => void;
  onStop: () => void;
  onTick: () => void;
}) {
  const running = state?.running;
  return (
    <header className="flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#08090d]/60 px-6 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              running ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" : "bg-zinc-600"
            }`}
          />
          <span className="text-sm text-zinc-300">
            {running ? "Autonomous loop active" : "Agent stopped"}
          </span>
        </div>
        {state && (
          <>
            <Badge tone={state.identity.mode === "live" ? "accent" : "info"}>
              {state.identity.mode}
            </Badge>
            <Badge tone="neutral">{state.identity.network}</Badge>
            {state.identity.nametag && (
              <Badge tone="neutral">@{state.identity.nametag}</Badge>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {state && (
          <div className="mr-2 hidden items-center gap-4 text-xs text-zinc-400 sm:flex">
            <span className="flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5 text-cyan-400" />
              tick #{state.tickCount}
            </span>
            <span>
              {formatNumber(state.walletBalance, 2)} {state.walletCurrency}
            </span>
          </div>
        )}
        <Button size="sm" variant="secondary" onClick={onTick}>
          <RefreshCw className="h-3.5 w-3.5" />
          Tick
        </Button>
        {running ? (
          <Button size="sm" variant="secondary" onClick={onStop}>
            <Pause className="h-3.5 w-3.5" />
            Stop
          </Button>
        ) : (
          <Button size="sm" onClick={onStart}>
            <Play className="h-3.5 w-3.5" />
            Start
          </Button>
        )}
      </div>
    </header>
  );
}
