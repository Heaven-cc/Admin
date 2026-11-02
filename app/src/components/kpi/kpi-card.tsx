"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Info } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { formatDelta, formatMoney, formatNumber, formatRelative } from "@/lib/utils/format";
import type { MetricCard } from "@/lib/data/types";
import { cn } from "@/lib/utils/cn";

export function FreshnessChip({ freshness }: { freshness: MetricCard["freshness"] }) {
  const { status, asAt, slaMinutes } = freshness;
  const label =
    status === "not_instrumented" ? "not instrumented"
    : status === "stale" ? "stale"
    : status === "estimated" ? "estimated"
    : asAt ? formatRelative(asAt)
    : "no data";
  return (
    <Tooltip
      content={
        <span>
          Source freshness (SLA {slaMinutes >= 1440 ? `${slaMinutes / 1440} d` : `${slaMinutes} min`}).{" "}
          {asAt ? `Last updated ${formatRelative(asAt)}.` : "No data received yet."}
        </span>
      }
    >
      <span
        className={cn(
          "inline-flex cursor-help items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
          status === "live" && "bg-success-soft text-success",
          status === "estimated" && "bg-info-soft text-info",
          status === "stale" && "bg-warning-soft text-warning",
          status === "not_instrumented" && "bg-surface-muted text-muted-foreground"
        )}
      >
        {label}
      </span>
    </Tooltip>
  );
}

function DeltaChip({ percent }: { percent: number | null | undefined }) {
  if (percent === null || percent === undefined || !Number.isFinite(percent)) return null;
  const up = percent >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        up ? "text-success" : "text-danger"
      )}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {formatDelta(percent)}
    </span>
  );
}

export function KpiCard({ metric }: { metric: MetricCard }) {
  const { value, unit, currency, label, key, href, notInstrumented, freshness, deltaPercent } = metric;

  const body = (
    <div
      className={cn(
        "flex h-full flex-col justify-between rounded-lg border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow",
        metric.section === "gmv" && "border-l-4 border-l-gmv",
        metric.section === "odt_revenue" && "border-l-4 border-l-brand"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <FreshnessChip freshness={freshness} />
      </div>
      {notInstrumented ? (
        <div className="mt-3 rounded-md border border-dashed border-border p-2.5">
          <p className="text-xs text-muted-foreground">
            <Info aria-hidden className="mr-1 inline h-3.5 w-3.5" />
            {notInstrumented.reason}
          </p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            requires: {notInstrumented.requiredEvents.join(", ")}
          </p>
        </div>
      ) : (
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums tracking-tight">
            {value == null ? "Unavailable" : unit === "currency" && currency
              ? formatMoney(value ?? 0, currency, true)
              : unit === "percent"
                ? `${(value ?? 0).toFixed(1)}%`
                : formatNumber(value ?? 0)}
          </span>
          <DeltaChip percent={deltaPercent} />
        </div>
      )}
      <p className="mt-2 font-mono text-[10px] text-muted-foreground/60">{key}</p>
    </div>
  );

  return href ? (
    <Link href={href} className="block h-full focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  );
}

export function KpiGrid({ metrics }: { metrics: MetricCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {metrics.map((m) => (
        <KpiCard key={m.key} metric={m} />
      ))}
    </div>
  );
}

export function SectionHeader({ title, hint, accent }: { title: string; hint?: string; accent?: "brand" | "gmv" }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span
        aria-hidden
        className={cn(
          "h-4 w-1 rounded-full",
          accent === "gmv" ? "bg-gmv" : accent === "brand" ? "bg-brand" : "bg-border"
        )}
      />
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
