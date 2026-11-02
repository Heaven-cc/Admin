"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { CommandRow } from "@/lib/data/types";
import { humanize } from "@/lib/utils/format";

/** Approvals inbox (docs/04 §4.13) — two-person rule enforced server-side. */
export function ApprovalList({ commands }: { commands: CommandRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [reason, setReason] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState<string | null>(null);

  async function decide(id: string, decision: "approve" | "reject") {
    setBusy(id);
    try {
      const res = await fetch(`/api/v1/commands/${id}/${decision}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Request": "1" },
        body: JSON.stringify({ reason: (reason[id] ?? "").trim() || undefined }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? `${decision} failed`);
      toast("success", decision === "approve" ? "Command approved" : "Command rejected", decision === "approve" ? "Approval recorded. Production execution remains disabled." : undefined);
      router.refresh();
    } catch (err) {
      toast("error", "Action failed", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  if (commands.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No commands awaiting approval.</p>;
  }
  return (
    <div className="space-y-3">
      {commands.map((c) => (
        <div key={c.id} className="rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{humanize(c.commandType)} → {c.targetLabel ?? c.targetId}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                requested by {c.requestedByName} · <span className="font-mono">{c.id}</span>
              </p>
            </div>
            <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[10px]">{c.status}</code>
          </div>
          <pre className="mt-2 overflow-x-auto rounded-md bg-surface-muted p-2 font-mono text-[10px] text-muted-foreground">
            {JSON.stringify(c.payload, null, 2)}
          </pre>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Input
              placeholder="Rejection reason (required to reject)"
              className="h-8 w-72 text-xs"
              value={reason[c.id] ?? ""}
              onChange={(e) => setReason((prev) => ({ ...prev, [c.id]: e.target.value }))}
            />
            <Button size="sm" onClick={() => decide(c.id, "approve")} loading={busy === c.id}>
              <Check aria-hidden /> Approve
            </Button>
            <Button size="sm" variant="destructive" onClick={() => decide(c.id, "reject")} loading={busy === c.id}>
              <X aria-hidden /> Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
