import { Info, Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CapabilityInfo } from "@/lib/data/types";
import { cn } from "@/lib/utils/cn";

/**
 * Honest capability status (docs/01 FR-755/FR-766): roadmap features never
 * display as operational. Driven entirely by the capability payload.
 */
export function CapabilityBanner({ capability }: { capability: CapabilityInfo }) {
  const { status, product, lastVerifiedAt, note } = capability;
  if (status === "deployed" && !note) return null;
  const planned = status === "planned";
  return (
    <div
      role="note"
      className={cn(
        "mb-4 flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-xs",
        planned ? "border-border bg-surface-muted text-muted-foreground" : "border-warning/40 bg-warning-soft text-warning"
      )}
    >
      {planned ? <Rocket aria-hidden className="mt-0.5 h-4 w-4 shrink-0" /> : <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />}
      <div>
        <p className="font-medium">
          {product} capability status: <Badge tone={planned ? "neutral" : "warning"} className="ml-1">{status}</Badge>
        </p>
        <p className="mt-1">
          {planned
            ? "This capability is on the roadmap. The instrumentation below shows exactly which events will feed it once implemented — nothing is simulated here."
            : "This view only shows measurements supplied by the connected reporting source."}
          {note ? ` ${note}` : ""}
          {lastVerifiedAt ? ` Last verified ${lastVerifiedAt.slice(0, 10)}.` : ""}
        </p>
      </div>
    </div>
  );
}
