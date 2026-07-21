"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useGuardian } from "@/hooks/use-guardian";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { state, start, stop, tick, error, loading } = useGuardian(5000);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="unicity-scene relative flex h-[100dvh] overflow-hidden text-[var(--foreground)]">
      {/* Ambient 3D-ish orbs + grid (CSS only) */}
      <div className="unicity-grid pointer-events-none absolute inset-0" />
      <div
        className="unicity-orb unicity-orb--gold pointer-events-none absolute -left-24 -top-24 h-72 w-72 sm:h-96 sm:w-96"
        aria-hidden
      />
      <div
        className="unicity-orb unicity-orb--orange pointer-events-none absolute -right-16 top-1/4 h-64 w-64 sm:h-80 sm:w-80"
        aria-hidden
      />
      <div
        className="unicity-orb unicity-orb--crimson pointer-events-none absolute bottom-0 left-1/3 h-56 w-56 sm:h-72 sm:w-72"
        aria-hidden
      />

      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <Topbar
          state={state}
          onStart={start}
          onStop={stop}
          onTick={tick}
          onMenu={() => setMenuOpen(true)}
        />
        <main className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5 lg:p-6">
          {error && (
            <div className="mb-4 rounded-xl border border-[rgba(201,58,42,0.35)] bg-[rgba(201,58,42,0.12)] px-4 py-3 text-sm text-[#f0a090]">
              {error}
            </div>
          )}
          {loading && !state ? (
            <div className="flex h-64 items-center justify-center text-sm text-[var(--muted)]">
              <span className="gold-text font-medium">
                Bootstrapping Guardian runtime…
              </span>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
