"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NAV_GROUPS } from "./nav-config";

interface PaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permissions: string[];
  businesses: { id: string; name: string }[];
}

export function CommandPalette({ open, onOpenChange, permissions, businesses }: PaletteProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [index, setIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const pages = React.useMemo(
    () =>
      NAV_GROUPS.flatMap((g) => g.items)
        .filter((item) => permissions.includes(item.permission))
        .filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
    [permissions, query]
  );
  const biz = React.useMemo(
    () =>
      businesses
        .filter((b) => b.name.toLowerCase().includes(query.toLowerCase()) || b.id.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 6),
    [businesses, query]
  );
  const flat = React.useMemo(
    () => [
      ...pages.map((p) => ({ href: p.href, label: p.label, kind: "Page" as const })),
      ...biz.map((b) => ({ href: `/businesses/${b.id}`, label: b.name, kind: "Business" as const })),
    ],
    [pages, biz]
  );

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(i + 1, flat.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && flat[index]) { e.preventDefault(); go(flat[index].href); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[15%] max-w-xl translate-y-0 p-0" onKeyDown={onKeyDown}>
        <DialogHeader className="mb-0 border-b border-border p-3 pr-10">
          <DialogTitle className="sr-only">Command palette</DialogTitle>
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIndex(0); }}
            placeholder="Type a page or business name…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto p-2">
          {flat.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">No matches for “{query}”.</p>
          ) : (
            flat.map((item, i) => (
              <button
                key={`${item.kind}-${item.href}-${item.label}`}
                type="button"
                onMouseEnter={() => setIndex(i)}
                onClick={() => go(item.href)}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                  i === index ? "bg-brand-soft text-brand" : "hover:bg-surface-muted"
                }`}
              >
                <span className="truncate">{item.label}</span>
                <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">{item.kind}</span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
