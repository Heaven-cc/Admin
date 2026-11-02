"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Select } from "@/components/ui/input";
import { RANGE_OPTIONS, type DateRange } from "@/lib/data/types";

/** URL-driven date-range filter (docs/06 §2: URL is the source of truth). */
export function DateRangePicker({ enabled = true }: { enabled?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = (params.get("range") as DateRange | null) ?? "30d";

  if (!enabled) return null;

  function setRange(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "30d") next.delete("range");
    else next.set("range", value);
    next.delete("cursor");
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <CalendarDays aria-hidden className="h-4 w-4" />
      <span className="sr-only">Date range</span>
      <Select value={current} onChange={(e) => setRange(e.target.value)} aria-label="Date range">
        {RANGE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
    </label>
  );
}
