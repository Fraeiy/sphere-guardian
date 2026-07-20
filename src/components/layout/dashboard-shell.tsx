"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useGuardian } from "@/hooks/use-guardian";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { state, start, stop, tick, error, loading } = useGuardian(5000);

  return (
    <div className="flex h-screen overflow-hidden bg-[#05060a] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.07),_transparent_50%),radial-gradient(ellipse_at_bottom_right,_rgba(139,92,246,0.06),_transparent_45%)]" />
      <Sidebar />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <Topbar state={state} onStart={start} onStop={stop} onTick={tick} />
        <main className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}
          {loading && !state ? (
            <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
              Bootstrapping Guardian runtime…
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
