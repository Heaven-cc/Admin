"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

const STATUSES = ["open", "investigating", "mitigated", "resolved", "closed"];

/** Status stepper + timeline entry form (docs/04 §4.11) — managers only. */
export function IncidentControls({
  incidentId, status, canManage,
}: { incidentId: string; status: string; canManage: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [next, setNext] = React.useState(status);
  const [entry, setEntry] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  if (!canManage) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/incidents/${incidentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Admin-Request": "1" },
        body: JSON.stringify({
          status: next !== status ? next : undefined,
          entry: entry.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Update failed");
      toast("success", "Incident updated");
      setEntry("");
      router.refresh();
    } catch (err) {
      toast("error", "Update failed", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1">
          <span className="block text-xs font-medium text-muted-foreground">Status</span>
          <Select value={next} onChange={(e) => setNext(e.target.value)} className="w-44">
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </label>
        <Button type="submit" variant="outline" loading={loading} disabled={next === status && !entry.trim()}>
          Apply
        </Button>
      </div>
      <label className="block space-y-1">
        <span className="block text-xs font-medium text-muted-foreground">Add timeline entry</span>
        <Input value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="What changed?" />
      </label>
    </form>
  );
}
