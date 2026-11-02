"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, type RoleKey } from "@/lib/auth/permissions";

export function UserMenu({ name, email, role }: { name: string; email: string; role: RoleKey }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  async function logout() {
    const res = await fetch("/api/v1/auth/logout", { method: "POST", headers: { "X-Admin-Request": "1" } }).catch(() => null);
    if (!res?.ok) { setError("Logout could not be completed. Try again."); return; }
    router.push("/login");
    router.refresh();
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md p-1 pr-2 transition-colors hover:bg-surface-muted">
        <Avatar name={name} />
        <span className="hidden text-left leading-tight lg:block">
          <span className="block text-xs font-semibold">{name}</span>
          <span className="block text-[10px] text-muted-foreground">{ROLE_LABELS[role]}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <DropdownMenuLabel>{email}</DropdownMenuLabel>{error ? <p role="alert" className="px-2 text-xs text-danger">{error}</p> : null}
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <Badge tone="brand">{ROLE_LABELS[role]}</Badge>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout} className="text-danger">
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
