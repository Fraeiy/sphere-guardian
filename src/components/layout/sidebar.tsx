"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bot,
  FileWarning,
  FolderKanban,
  LayoutDashboard,
  Settings,
  ShoppingBag,
  Store,
  Wallet,
  Shield,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/incidents", label: "Incidents", icon: FileWarning },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/activity", label: "Guardian Activity", icon: Activity },
  { href: "/transactions", label: "Transactions", icon: Wallet },
  { href: "/services", label: "Agent Services", icon: Store },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  open = false,
  onClose,
}: {
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();

  const body = (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[rgba(232,163,23,0.35)] via-[rgba(232,122,26,0.2)] to-[rgba(201,58,42,0.25)] ring-1 ring-[var(--border-strong)] shadow-[0_8px_24px_-10px_rgba(232,163,23,0.55)]">
            <div
              aria-hidden
              className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent to-white/10"
            />
            <Shield className="relative h-5 w-5 text-[#f5d78e]" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight gold-text">
              Sphere Guardian
            </div>
            <div className="text-[11px] text-[var(--muted)]">
              Autonomous NOC Agent
            </div>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white/[0.03] text-[var(--muted-strong)] lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "group flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                active
                  ? "bg-gradient-to-r from-[rgba(232,163,23,0.16)] to-[rgba(232,122,26,0.06)] text-[var(--foreground)] shadow-[0_1px_0_rgba(255,220,160,0.08)_inset] ring-1 ring-[var(--border-strong)]"
                  : "text-[var(--muted)] hover:bg-[rgba(232,163,23,0.06)] hover:text-[var(--foreground)]"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active
                    ? "text-[var(--primary-bright)]"
                    : "text-[var(--muted)] group-hover:text-[var(--primary)]"
                )}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border)] p-4 safe-pb">
        <div className="depth-inset flex items-center gap-2 rounded-xl px-3 py-2.5 ring-1 ring-[var(--border)]">
          <Bot className="h-4 w-4 shrink-0 text-[var(--orange)]" />
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-[var(--foreground)]">
              Machine economy ready
            </div>
            <div className="truncate text-[10px] text-[var(--muted)]">
              Identity · Wallet · Market · Settle
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="depth-panel relative z-20 hidden h-full w-64 shrink-0 flex-col border-r border-[var(--border)] lg:flex">
        {body}
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 lg:hidden",
          open ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <button
          type="button"
          aria-label="Close menu overlay"
          onClick={onClose}
          className={cn(
            "absolute inset-0 bg-black/60 transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0"
          )}
        />
        <aside
          className={cn(
            "depth-panel absolute inset-y-0 left-0 flex w-[min(18rem,88vw)] flex-col border-r border-[var(--border)] transition-transform duration-300 ease-out",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {body}
        </aside>
      </div>
    </>
  );
}
