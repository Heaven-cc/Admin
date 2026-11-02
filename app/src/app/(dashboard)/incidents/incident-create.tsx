"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

const SERVICES = ["trexven_api", "owner_app", "pos_app", "vision_service", "angel_service", "sync_pipeline", "payment_webhooks", "admin_platform"];

export function IncidentCreate({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [severity, setSeverity] = React.useState("S3");
  const [services, setServices] = React.useState<string[]>([]);
  const [note, setNote] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!canManage) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Request": "1" },
        body: JSON.stringify({ title, severity, services, note: note || undefined }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Failed to create incident");
      toast("success", "Incident opened", "Incident and timeline saved.");
      setOpen(false);
      setTitle(""); setNote(""); setServices([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus aria-hidden /> New incident</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open incident</DialogTitle>
            <DialogDescription>Incidents create internal notifications. External alert delivery requires an approved integration.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={4} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Severity">
                <Select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                  {["S1", "S2", "S3", "S4"].map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="Services affected">
                <Select
                  value={services[0] ?? ""}
                  onChange={(e) => setServices(e.target.value ? [e.target.value] : [])}
                >
                  <option value="">— none —</option>
                  {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Initial note"><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What is happening?" /></Field>
            {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={loading}>Open incident</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
