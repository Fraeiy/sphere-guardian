"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GuardianStateSnapshot } from "@/domain/types";
import { formatNumber } from "@/lib/utils";
import { Menu, Pause, Play, RefreshCw, Radio } from "lucide-react";

export function Topbar({
  state,
  onStart,
  onStop,
  onTick,
  onMenu,
}: {
  state: GuardianStateSnapshot | null;
  onStart: () => void;
  onStop: () => void;
  onTick: () => void;
  onMenu?: () => void;
}) {
  const running = state?.running;
  return (
    <header className="relative z-10 flex min-h-14 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-glass-strong)] px-3 backdrop-blur-xl sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(232,163,23,0.35)] to-transparent"
      />
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {onMenu && (
          <button
            type="button"
            onClick={onMenu}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-white/[0.03] text-[var(--muted-strong)] lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              running
                ? "bg-[var(--primary)] shadow-[0_0_12px_rgba(232,163,23,0.9)]"
                : "bg-zinc-600"
            }`}
          />
          <span className="truncate text-xs text-[var(--muted-strong)] sm:text-sm">
            {running ? "Autonomous loop active" : "Agent stopped"}
          </span>
        </div>
        {state && (
          <div className="hidden items-center gap-2 md:flex">
            <Badge tone={state.identity.mode === "live" ? "accent" : "info"}>
              {state.identity.mode}
            </Badge>
            <Badge tone="neutral">{state.identity.network}</Badge>
            {state.identity.nametag && (
              <Badge tone="neutral">@{state.identity.nametag}</Badge>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        {state && (
          <div className="mr-1 hidden items-center gap-3 text-xs text-[var(--muted)] xl:flex">
            <span className="flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5 text-[var(--primary)]" />
              tick #{state.tickCount}
            </span>
            <span className="font-medium text-[var(--primary-bright)]">
              {formatNumber(state.walletBalance, 2)} {state.walletCurrency}
            </span>
          </div>
        )}
        <Button size="sm" variant="secondary" onClick={onTick}>
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Tick</span>
        </Button>
        {running ? (
          <Button size="sm" variant="secondary" onClick={onStop}>
            <Pause className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Stop</span>
          </Button>
        ) : (
          <Button size="sm" onClick={onStart}>
            <Play className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Start</span>
          </Button>
        )}
      </div>
    </header>
  );
}
