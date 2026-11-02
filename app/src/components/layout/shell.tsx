"use client";

import * as React from "react";
import { BrandLogo } from "@/components/brand-logo";
import { Menu } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import type { RoleKey } from "@/lib/auth/permissions";
import type { NotificationRow } from "@/lib/data/types";

export function Shell({
  permissions, role, name, email, notifications, notificationsUnavailable = false, syncStatus, businesses, children,
}: {
  permissions: string[]; role: RoleKey; name: string; email: string;
  notifications: NotificationRow[]; notificationsUnavailable?: boolean; syncStatus: string;
  businesses: { id: string; name: string }[];
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar permissions={permissions} role={role} syncStatus={syncStatus} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center border-b border-border px-4 py-2 md:hidden"><Dialog open={navOpen} onOpenChange={setNavOpen}><DialogTrigger aria-label="Open navigation" className="rounded p-2"><Menu className="h-5 w-5" /></DialogTrigger><DialogContent className="max-h-[90dvh] w-[min(90vw,20rem)] overflow-y-auto p-2"><DialogTitle className="sr-only">Admin navigation</DialogTitle><DialogDescription className="sr-only">Choose an administration module.</DialogDescription><div onClick={e => { if ((e.target as HTMLElement).closest("a")) setNavOpen(false); }}><Sidebar permissions={permissions} role={role} syncStatus={syncStatus} mobile /></div></DialogContent></Dialog><BrandLogo className="ml-2 w-12" /><span className="ml-2 text-xs font-semibold">TREXVEN Admin</span></div>
        <Topbar
          name={name} email={email} role={role}
          notifications={notifications} notificationsUnavailable={notificationsUnavailable} onOpenPalette={() => setPaletteOpen(true)}
        />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
      <CommandPalette
        open={paletteOpen} onOpenChange={setPaletteOpen}
        permissions={permissions} businesses={businesses}
      />
    </div>
  );
}
