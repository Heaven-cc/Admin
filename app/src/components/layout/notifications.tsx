"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, Moon, Sun } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRelative } from "@/lib/utils/format";
import type { NotificationRow } from "@/lib/data/types";
import { cn } from "@/lib/utils/cn";

export function ThemeToggle() {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  return (
    <button
      type="button"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle("dark", next);
        try { localStorage.setItem("theme", next ? "dark" : "light"); } catch { /* ignore */ }
      }}
      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export function Notifications({ items, unavailable = false }: { items: NotificationRow[]; unavailable?: boolean }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const unread = items.filter((n) => !n.read).length;
  async function markAllRead() {
    try { const res = await fetch("/api/v1/notifications/read", { method: "POST", headers: { "X-Admin-Request": "1" } }); if (!res.ok) throw new Error("Could not save notification receipts."); setError(null); router.refresh(); } catch(e) { setError(e instanceof Error ? e.message : "Request failed."); }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Notifications" className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground">
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span aria-hidden className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" />
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          <button disabled={unavailable} onClick={markAllRead} className="inline-flex items-center gap-1 text-xs text-brand hover:underline">
            <Check className="h-3 w-3" /> Mark all read
          </button>
        </div>
        {error ? <p role="alert" className="p-3 text-xs text-danger">{error}</p> : null}<div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">{unavailable ? "Notifications are unavailable. Refresh to retry." : "No notifications are available for your role."}</p>
          ) : (
            items.slice(0, 8).map((n) => (
              <div key={n.id} className={cn("border-b border-border px-3 py-2.5 last:border-0", !n.read && "bg-brand-soft/40")}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold">{n.href?.startsWith("/") && !n.href.startsWith("//") ? <a href={n.href} className="hover:text-brand hover:underline">{n.title}</a> : n.title}</p>
                  <span className="text-[10px] text-muted-foreground">{formatRelative(n.at)}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
