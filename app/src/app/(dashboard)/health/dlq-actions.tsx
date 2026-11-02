"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function DeadLetterActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  if (status === "resolved" || status === "discarded") return <span className="text-xs text-muted-foreground">—</span>;

  async function retry() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/health/dead-letters/${id}/retry`, { method: "POST", headers: { "X-Admin-Request": "1" } });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message ?? "Retry failed");
      toast("success", "Dead letter resolved", "Queued for replay through the normal pipeline.");
      router.refresh();
    } catch (err) {
      toast("error", "Retry failed", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={retry} loading={loading}>
      <RotateCcw aria-hidden /> Retry
    </Button>
  );
}
