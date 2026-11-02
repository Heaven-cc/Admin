import { AlertTriangle, Ban, RefreshCw, WifiOff } from "lucide-react";
import { Skeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface p-10 text-center">
      <AlertTriangle aria-hidden className="h-8 w-8 text-danger" />
      <p className="mt-3 text-sm font-medium">Couldn&apos;t load this view</p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
        {message ?? "An unexpected error occurred. Try again or contact an administrator."}
      </p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw aria-hidden /> Retry
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, description, action }: {
  title: string; description?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface p-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function NotInstrumented({ requiredEvents, note }: { requiredEvents: string[]; note?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface p-10 text-center">
      <Ban aria-hidden className="h-7 w-7 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">Not instrumented yet</p>
      <p className="mt-1 max-w-md text-xs text-muted-foreground">
        {note ?? "No production events feed this metric yet. Nothing is invented — the view activates when telemetry arrives."}
      </p>
      <p className="mt-2 font-mono text-[10px] text-muted-foreground">
        requires: {requiredEvents.join(", ")} (docs/10 §8)
      </p>
    </div>
  );
}

export function StaleBanner({ lagMinutes, lastEventAt }: { lagMinutes: number | null; lastEventAt?: string | null }) {
  if (lagMinutes === null) return null;
  return (
    <div role="status" className="mb-4 flex items-center gap-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-warning">
      <WifiOff aria-hidden className="h-3.5 w-3.5" />
      <span>
        Data is <strong>{lagMinutes} min</strong> behind — last sync{" "}
        {lastEventAt ? new Date(lastEventAt).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "unknown"}.
        View <a href="/health" className="underline">sync health</a>.
      </span>
    </div>
  );
}

export function Unauthorized({ permission }: { permission: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface p-10 text-center">
      <Ban aria-hidden className="h-7 w-7 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">You don&apos;t have access to this section</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Required permission: <code className="font-mono">{permission}</code>
      </p>
    </div>
  );
}

export function KpiSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-7 w-20" />
          <Skeleton className="mt-3 h-2.5 w-16" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className={`h-8 flex-1 ${c === 0 ? "max-w-[220px]" : ""}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
