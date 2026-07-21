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
      return "text-[#e87a6a]";
    case "high":
      return "text-[var(--orange)]";
    case "medium":
      return "text-[var(--primary-bright)]";
    case "low":
      return "text-[#f0c14d]";
    default:
      return "text-[var(--muted)]";
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
      return "text-[var(--primary-bright)]";
    case "unhealthy":
    case "failed":
    case "critical":
      return "text-[#e87a6a]";
    default:
      return "text-[var(--muted)]";
  }
}
