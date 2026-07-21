import { Badge } from "@/components/ui/badge";
import type { ActivityEvent } from "@/domain/types";
import { relativeTime, severityColor } from "@/lib/utils";

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (!events.length) {
    return (
      <div className="py-10 text-center text-sm text-[var(--muted)]">
        Waiting for autonomous decisions…
      </div>
    );
  }

  return (
    <ol className="space-y-0">
      {events.map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pb-5 sm:gap-4 sm:pb-6">
          {i < events.length - 1 && (
            <span className="absolute left-[7px] top-5 h-full w-px bg-gradient-to-b from-[rgba(232,163,23,0.35)] via-[rgba(232,122,26,0.15)] to-transparent sm:left-[9px]" />
          )}
          <span
            className={`mt-1.5 h-[10px] w-[10px] shrink-0 rounded-full ring-4 ring-[var(--card)] ${
              e.severity === "critical" || e.severity === "high"
                ? "bg-[var(--crimson)] shadow-[0_0_10px_rgba(201,58,42,0.7)]"
                : e.kind.includes("resolved") || e.kind === "payment_settled"
                  ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                  : "bg-[var(--primary)] shadow-[0_0_10px_rgba(232,163,23,0.7)]"
            }`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-[var(--foreground)]">
                {e.title}
              </span>
              <Badge tone="neutral">{e.kind.replace(/_/g, " ")}</Badge>
              {e.severity && (
                <span className={`text-[11px] ${severityColor(e.severity)}`}>
                  {e.severity}
                </span>
              )}
              <span className="text-[11px] text-[var(--muted)]">
                {relativeTime(e.timestamp)}
              </span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-[var(--muted-strong)]">
              {e.detail}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
