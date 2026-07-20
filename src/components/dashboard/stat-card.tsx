import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "cyan",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent?: "cyan" | "violet" | "emerald" | "amber" | "rose";
}) {
  const accents = {
    cyan: "from-cyan-400/15 to-transparent text-cyan-300",
    violet: "from-violet-400/15 to-transparent text-violet-300",
    emerald: "from-emerald-400/15 to-transparent text-emerald-300",
    amber: "from-amber-400/15 to-transparent text-amber-300",
    rose: "from-rose-400/15 to-transparent text-rose-300",
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="relative p-5">
        <div
          className={cn(
            "pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br opacity-80",
            accents[accent]
          )}
        />
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              {label}
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">
              {value}
            </div>
            {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
          </div>
          <div
            className={cn(
              "rounded-xl bg-gradient-to-br p-2.5 ring-1 ring-white/10",
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
