import { Badge } from "@/components/ui/badge";
import type { ActivityEvent } from "@/domain/types";
import { relativeTime, severityColor } from "@/lib/utils";

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (!events.length) {
    return (
      <div className="py-10 text-center text-sm text-zinc-500">
        Waiting for autonomous decisions…
      </div>
    );
  }

  return (
    <ol className="space-y-0">
      {events.map((e, i) => (
        <li key={e.id} className="relative flex gap-4 pb-6">
          {i < events.length - 1 && (
            <span className="absolute left-[9px] top-5 h-full w-px bg-white/[0.06]" />
          )}
          <span
            className={`mt-1.5 h-[10px] w-[10px] shrink-0 rounded-full ring-4 ring-[#0c0d12] ${
              e.severity === "critical" || e.severity === "high"
                ? "bg-rose-400"
                : e.kind.includes("resolved") || e.kind === "payment_settled"
                  ? "bg-emerald-400"
                  : "bg-cyan-400"
            }`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-zinc-100">{e.title}</span>
              <Badge tone="neutral">{e.kind.replace(/_/g, " ")}</Badge>
              {e.severity && (
                <span className={`text-[11px] ${severityColor(e.severity)}`}>
                  {e.severity}
                </span>
              )}
              <span className="text-[11px] text-zinc-600">
                {relativeTime(e.timestamp)}
              </span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">{e.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
