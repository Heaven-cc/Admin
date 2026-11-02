"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";

type Action = "suspend" | "restore" | "delete";
const labels: Record<Action, string> = { suspend: "Suspend account", restore: "Restore account", delete: "Delete business" };

export function BusinessActions({ businessId, businessName, accountStatus, canSuspend, canRestore, canDelete, backendReady }: {
  businessId: string; businessName: string; accountStatus: string;
  canSuspend: boolean; canRestore: boolean; canDelete: boolean; backendReady: boolean;
}) {
  const router = useRouter(), { toast } = useToast();
  const [action, setAction] = React.useState<Action | null>(null);
  const [reason, setReason] = React.useState(""), [confirmation, setConfirmation] = React.useState(""), [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false), [error, setError] = React.useState<string | null>(null), [progress, setProgress] = React.useState<string | null>(null);
  const requestId = React.useRef<string | null>(null);
  const deleting = accountStatus === "deleting", suspended = accountStatus === "suspended";

  function open(next: Action) {
    setAction(next); setReason(""); setConfirmation(""); setCode(""); setError(null); setProgress(null); requestId.current = crypto.randomUUID();
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!action || !requestId.current || busy || !backendReady) return;
    setBusy(true); setError(null); setProgress(null);
    try {
      if (action === "delete") {
        const sb = createClient(), { data, error: factorsError } = await sb.auth.mfa.listFactors();
        const factor = data?.totp.find(f => f.status === "verified");
        if (factorsError || !factor) throw new Error("A verified authenticator is required to delete a business.");
        const { error: mfaError } = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
        setCode(""); if (mfaError) throw new Error("The authenticator code could not be verified. Enter a current code and try again.");
      }
      for (let attempt = 0; attempt < 20; attempt++) {
        setProgress(action === "delete" ? "Deleting business data and cleaning up media..." : "Waiting for the production result...");
        const response: Response = await fetch(`/api/v1/businesses/${businessId}/actions`, {
          method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Request": "1" },
          body: JSON.stringify({ id: requestId.current, action, reason: reason.trim(), confirmation }),
        });
        const body: { data?: { id: string; finished: boolean; error_code?: string; message?: string }; error?: { message?: string } } | null = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error?.message ?? "The action did not complete. Retry to recover its status.");
        if (!body?.data) throw new Error("The production result could not be read. Retry the action.");
        if (typeof body.data.id === "string") requestId.current = body.data.id;
        if (body.data.finished === true) {
          toast("success", action === "delete" ? "Business permanently deleted" : action === "suspend" ? "Business suspended" : "Business restored");
          setAction(null);
          if (action === "delete") router.replace("/businesses");
          router.refresh(); return;
        }
        router.refresh();
        if (body.data.error_code) throw new Error(body.data.message ?? "Deletion is incomplete. Retry to continue.");
      }
      setProgress("Deletion is still in progress. The business remains disabled. Submit again with a current authenticator code to continue.");
    } catch (error) {
      setProgress(null); setError(error instanceof Error ? error.message : "The business action could not complete."); router.refresh();
    } finally { setBusy(false); }
  }

  if (!canSuspend && !canRestore && !canDelete) return <p className="rounded-md border border-border bg-surface-muted p-3 text-xs text-muted-foreground">Your role does not permit business account actions.</p>;
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2">
      {suspended ? canRestore && <Button variant="outline" disabled={!backendReady} onClick={() => open("restore")}><RotateCcw aria-hidden /> Restore account</Button>
        : canSuspend && <Button variant="destructive" disabled={deleting || !backendReady} onClick={() => open("suspend")}><Ban aria-hidden /> Suspend account</Button>}
      {canDelete ? <Button variant="destructive" disabled={!backendReady} onClick={() => open("delete")}><Trash2 aria-hidden /> {deleting ? "Continue deletion" : "Delete business"}</Button> : null}
    </div>
    <p className="text-xs text-muted-foreground">Suspension disables access to this business until it is restored. Permanent deletion is restricted to Super Admin and requires fresh authenticator verification.</p>
    {!backendReady ? <p role="status" className="rounded-md bg-warning-soft p-3 text-xs text-warning">These controls are waiting for the production backend configuration to be approved and applied.</p> : null}
    {deleting ? <p role="status" className="rounded-md bg-danger-soft p-3 text-xs text-danger">Permanent deletion has started. Business access is disabled while cleanup completes.</p> : null}
    <Dialog open={action !== null} onOpenChange={open => { if (!open && !busy) setAction(null); }}>
      <DialogContent onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>{action ? labels[action] : "Business action"}</DialogTitle>
          <DialogDescription>{businessName}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className={`rounded-md p-3 text-xs ${action === "delete" ? "bg-danger-soft text-danger" : "bg-surface-muted text-muted-foreground"}`}>
            {action === "delete" ? "Permanently erases this business and its linked sales, stock, payments, staff memberships, camera records, and business-owned Supabase media. This cannot be undone. Shared user accounts and unrelated businesses are preserved. A minimal security audit record is retained."
              : action === "suspend" ? "Disables this business's data access and operations. Its records and subscription billing configuration are retained."
              : "Restores business access. Existing subscription and staff permissions still apply."}
          </div>
          <Field label="Reason"><Textarea required minLength={8} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} disabled={busy} /></Field>
          <Field label={`Type "${businessName}" to confirm`}><Input required autoComplete="off" value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} /></Field>
          {action === "delete" ? <Field label="Current authenticator code"><Input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} disabled={busy} /></Field> : null}
          {progress ? <p role="status" className="text-xs text-muted-foreground">{progress}</p> : null}
          {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setAction(null)}>Cancel</Button>
            <Button type="submit" variant={action === "restore" ? "default" : "destructive"} loading={busy} disabled={confirmation !== businessName || reason.trim().length < 8 || (action === "delete" && code.length !== 6)}>{action ? labels[action] : "Confirm"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}
