import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "success" | "warn" | "danger" | "info" | "accent";
}) {
  const tones: Record<string, string> = {
    neutral:
      "bg-white/[0.04] text-[var(--muted-strong)] border-[var(--border-subtle)]",
    success:
      "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
    warn:
      "bg-[rgba(232,163,23,0.12)] text-[#f0c14d] border-[rgba(232,163,23,0.28)]",
    danger:
      "bg-[rgba(201,58,42,0.14)] text-[#f0a090] border-[rgba(201,58,42,0.3)]",
    info:
      "bg-[rgba(232,122,26,0.12)] text-[#f0b070] border-[rgba(232,122,26,0.28)]",
    accent:
      "bg-[rgba(232,163,23,0.16)] text-[#f5d78e] border-[rgba(232,163,23,0.35)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:text-[11px]",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
