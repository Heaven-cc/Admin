"use client";

import { BrandLogo } from "@/components/brand-logo";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, Banknote, Brain, Camera, ChartColumn, CreditCard, Database,
  LayoutDashboard, ScrollText, Settings, Sparkles, Store, TriangleAlert, Users,
  type LucideIcon,
} from "lucide-react";
import { NAV_GROUPS } from "./nav-config";
import type { RoleKey } from "@/lib/auth/permissions";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils/cn";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, Store, CreditCard, Banknote, ChartColumn, Camera, Brain,
  Sparkles, Activity, TriangleAlert, Database, Users, ScrollText, Settings,
};

export function Sidebar({
  permissions, role, syncStatus, mobile = false,
}: { permissions: string[]; role: RoleKey; syncStatus: string; mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <aside className={cn("w-60 shrink-0 flex-col border-r border-border bg-surface", mobile ? "flex" : "hidden md:flex")}>
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <BrandLogo className="w-16" />
        <div className="leading-tight">
          <p className="text-sm font-semibold">ODT Admin</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">TREXVEN platform</p>
        </div>
      </div>
      <nav aria-label="Primary" className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => permissions.includes(item.permission));
          if (items.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const Icon = ICONS[item.icon] ?? Activity;
                  const active = pathname === item.href || (pathname.startsWith(item.href + "/") && !NAV_GROUPS.flatMap(g=>g.items).some(other=>other.href!==item.href && other.href.startsWith(item.href+"/") && pathname.startsWith(other.href)));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                          active
                            ? "bg-brand-soft font-medium text-brand"
                            : "text-foreground/80 hover:bg-surface-muted hover:text-foreground"
                        )}
                      >
                        {active ? (
                          <span aria-hidden className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-brand" />
                        ) : null}
                        <Icon aria-hidden className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="space-y-2 border-t border-border p-3 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>{ROLE_LABELS[role]}</span>
            <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px]">LIVE</span>
        </div>
        <Link href="/health" className="flex items-center gap-1.5 hover:text-foreground">
          <span
            aria-hidden
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              syncStatus === "healthy" && "bg-success",
              syncStatus === "lagging" && "bg-warning",
              (syncStatus === "down" || syncStatus === "no_data") && "bg-danger"
            )}
          />
          Sync: {syncStatus}
        </Link>
      </div>
    </aside>
  );
}
