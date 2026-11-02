"use client";

import { Command, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeToggle, Notifications } from "./notifications";
import { UserMenu } from "./user-menu";
import { ROLE_LABELS, type RoleKey } from "@/lib/auth/permissions";
import type { NotificationRow } from "@/lib/data/types";

export function Topbar({
  name, email, role, notifications, notificationsUnavailable = false, onOpenPalette,
}: {
  name: string; email: string; role: RoleKey;
  notifications: NotificationRow[]; notificationsUnavailable?: boolean; onOpenPalette: () => void;
}) {
  return (
    <TooltipProvider>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur md:px-6">
        <button
          type="button"
          onClick={onOpenPalette}
          className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-muted-foreground transition-colors hover:border-brand/40 sm:max-w-md"
        >
          <Search aria-hidden className="h-4 w-4" />
          <span className="truncate">Search businesses and pages…</span>
          <kbd className="ml-auto hidden items-center gap-0.5 rounded border border-border bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium sm:flex">
            <Command aria-hidden className="h-3 w-3" />K
          </kbd>
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          <Badge tone="neutral" className="hidden sm:inline-flex">ADMIN CLOUD</Badge>
          <ThemeToggle />
          <Notifications items={notifications} unavailable={notificationsUnavailable} />
          <UserMenu name={name} email={email} role={role} />
        </div>
      </header>
      <p className="sr-only">{ROLE_LABELS[role]} session</p>
    </TooltipProvider>
  );
}
