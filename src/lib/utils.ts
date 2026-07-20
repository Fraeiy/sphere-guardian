import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(digits);
}

export function formatPct(n: number): string {
  return `${n.toFixed(2)}%`;
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function severityColor(severity?: string): string {
  switch (severity) {
    case "critical":
      return "text-rose-400";
    case "high":
      return "text-orange-400";
    case "medium":
      return "text-amber-400";
    case "low":
      return "text-sky-400";
    default:
      return "text-zinc-400";
  }
}

export function statusColor(status?: string): string {
  switch (status) {
    case "healthy":
    case "resolved":
    case "completed":
    case "filled":
      return "text-emerald-400";
    case "degraded":
    case "negotiating":
    case "payment_pending":
      return "text-amber-400";
    case "unhealthy":
    case "failed":
    case "critical":
      return "text-rose-400";
    default:
      return "text-zinc-400";
  }
}
