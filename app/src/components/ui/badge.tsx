import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-surface-muted text-foreground",
        brand: "bg-brand-soft text-brand",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        danger: "bg-danger-soft text-danger",
        info: "bg-info-soft text-info",
        gmv: "bg-gmv-soft text-gmv",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

const STATUS_TONES: Record<string, BadgeProps["tone"]> = {
  // account / subscription
  active: "success", trialing: "info", trial: "info", pending: "warning",
  past_due: "warning", suspended: "danger", cancelled: "neutral", canceled: "neutral",
  churned: "neutral", invited: "info", deactivated: "neutral", deleting: "danger",
  // pipelines / services
  operational: "success", healthy: "success", live: "success", online: "success",
  delivered: "success", completed: "success", succeeded: "success", resolved: "success", ok: "success",
  degraded: "warning", lagging: "warning", retrying: "warning", stale: "warning",
  executing: "info", dispatching: "info", running: "info", acknowledged: "info",
  down: "danger", failed: "danger", quarantined: "danger", open: "danger", rejected: "danger",
  offline: "danger", investigating: "warning", mitigated: "info", closed: "neutral",
  planned: "neutral", implemented: "info", tested: "warning", deployed: "success",
  not_instrumented: "neutral", no_data: "neutral", unknown: "neutral",
  approved: "success", pending_approval: "warning", draft: "neutral",
  under_review: "warning", deprecated: "neutral", disabled: "neutral",
  "in_person": "neutral", email: "info", whatsapp: "success", call: "info", other: "neutral",
};

export function StatusChip({ status, className }: { status: string; className?: string }) {
  const tone = STATUS_TONES[status] ?? "neutral";
  const label = status.replace(/_/g, " ");
  return (
    <Badge tone={tone} className={className}>
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full",
        tone === "success" && "bg-success",
        tone === "warning" && "bg-warning",
        tone === "danger" && "bg-danger",
        tone === "info" && "bg-info",
        (tone === "neutral" || tone === "brand" || tone === "gmv") && "bg-muted-foreground",
      )} />
      {label}
    </Badge>
  );
}
