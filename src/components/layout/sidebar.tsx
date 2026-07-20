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

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-white/[0.06] bg-[#08090d]/90 backdrop-blur-xl">
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/20 to-violet-500/20 ring-1 ring-cyan-400/30">
          <Shield className="h-5 w-5 text-cyan-300" />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight text-zinc-50">
            Sphere Guardian
          </div>
          <div className="text-[11px] text-zinc-500">Autonomous NOC Agent</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 p-3">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                active
                  ? "bg-white/[0.06] text-zinc-50 shadow-inner ring-1 ring-white/[0.06]"
                  : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  active ? "text-cyan-300" : "text-zinc-500 group-hover:text-zinc-300"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/[0.06] p-4">
        <div className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/[0.05]">
          <Bot className="h-4 w-4 text-violet-300" />
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-zinc-200">
              Machine economy ready
            </div>
            <div className="truncate text-[10px] text-zinc-500">
              Identity · Wallet · Market · Settle
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
