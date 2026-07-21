import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "gold",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent?: "gold" | "orange" | "crimson" | "emerald" | "amber";
}) {
  const accents = {
    gold: "from-[rgba(232,163,23,0.2)] to-transparent text-[var(--primary-bright)]",
    orange: "from-[rgba(232,122,26,0.2)] to-transparent text-[var(--orange)]",
    crimson: "from-[rgba(201,58,42,0.2)] to-transparent text-[#e87a6a]",
    emerald: "from-emerald-400/15 to-transparent text-emerald-300",
    amber: "from-[rgba(240,180,40,0.18)] to-transparent text-[#f0c14d]",
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="relative p-4 sm:p-5">
        {/* 3D bevel highlight */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(255,220,160,0.25)] to-transparent"
        />
        <div
          className={cn(
            "pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br opacity-90 blur-2xl",
            accents[accent]
          )}
        />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)] sm:text-xs">
              {label}
            </div>
            <div className="mt-2 truncate text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl">
              {value}
            </div>
            {hint && (
              <div className="mt-1 text-[11px] leading-snug text-[var(--muted)] sm:text-xs">
                {hint}
              </div>
            )}
          </div>
          <div
            className={cn(
              "shrink-0 rounded-xl bg-gradient-to-br p-2.5 ring-1 ring-[var(--border-strong)] shadow-[0_8px_20px_-10px_rgba(0,0,0,0.8)]",
              accents[accent]
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
