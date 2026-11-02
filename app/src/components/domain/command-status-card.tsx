"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed, Clock, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils/format";
import type { CommandRow } from "@/lib/data/types";
import { cn } from "@/lib/utils/cn";

const STEPS = ["pending_approval", "approved", "executing", "completed"] as const;

function stepIndex(status: CommandRow["status"]): number {
  if (status === "pending_approval") return 0;
  if (status === "approved" || status === "dispatching") return 1;
  if (status === "executing") return 2;
  if (status === "completed") return 3;
  return -1; // rejected / failed / cancelled
}

/** Live command state machine (docs/04 §4.16) — polls while in flight. */
export function CommandStatusCard({ commandId }: { commandId: string }) {
  const { data } = useQuery({
    queryKey: ["command", commandId],
    queryFn: async (): Promise<CommandRow> => {
      const res = await fetch(`/api/v1/commands/${commandId}`);
      if (!res.ok) throw new Error("Failed to load command");
      const body = await res.json();
      return body.data;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && ["pending_approval", "approved", "dispatching", "executing"].includes(status) ? 2000 : false;
    },
  });

  if (!data) return null;
  const idx = stepIndex(data.status);
  const terminalBad = data.status === "failed" || data.status === "rejected" || data.status === "cancelled";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Command {data.id}</CardTitle>
        <StatusChip status={data.status} />
      </CardHeader>
      <CardContent className="space-y-3">
        <ol className="flex items-center gap-1.5">
          {STEPS.map((step, i) => {
            const done = idx > i || data.status === "completed";
            const active = idx === i && !terminalBad;
            return (
              <li key={step} className="flex flex-1 items-center gap-1.5">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px]",
                    done && "border-success bg-success-soft text-success",
                    active && "border-brand bg-brand-soft text-brand",
                    !done && !active && "border-border text-muted-foreground"
                  )}
                >
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CircleDashed className="h-3.5 w-3.5" />}
                </span>
                {i < STEPS.length - 1 ? <span aria-hidden className={cn("h-px flex-1", done ? "bg-success" : "bg-border")} /> : null}
              </li>
            );
          })}
        </ol>
        <dl className="space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between"><dt>Requested by</dt><dd className="text-foreground">{data.requestedByName}</dd></div>
          {data.approverName ? <div className="flex justify-between"><dt>{data.status === "rejected" ? "Rejected by" : "Approved by"}</dt><dd className="text-foreground">{data.approverName}</dd></div> : null}
          <div className="flex justify-between"><dt>Created</dt><dd>{formatDateTime(data.createdAt)}</dd></div>
          {data.completedAt ? <div className="flex justify-between"><dt>Finished</dt><dd>{formatDateTime(data.completedAt)}</dd></div> : null}
        </dl>
        {data.error ? (
          <p className="rounded-md bg-danger-soft px-2.5 py-1.5 text-xs text-danger">{data.error}</p>
        ) : null}
        {data.status === "pending_approval" ? (
          <p className="flex items-center gap-1.5 rounded-md bg-warning-soft px-2.5 py-1.5 text-xs text-warning">
            <Clock aria-hidden className="h-3.5 w-3.5" /> Waiting for a second administrator to approve.
          </p>
        ) : null}
        {data.status === "completed" ? (
          <p className="rounded-md bg-success-soft px-2.5 py-1.5 text-xs text-success">
            Verified complete — projections update only from the command result (docs/03 D3).
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
