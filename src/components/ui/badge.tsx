import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "success" | "warn" | "danger" | "info" | "accent";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-white/5 text-zinc-300 border-white/10",
    success: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    warn: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    danger: "bg-rose-500/10 text-rose-300 border-rose-500/20",
    info: "bg-sky-500/10 text-sky-300 border-sky-500/20",
    accent: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
