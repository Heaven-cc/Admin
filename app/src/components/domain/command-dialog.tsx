"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { COMMAND_TYPES } from "@/lib/auth/permissions";

export interface CommandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commandType: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  /** Text the user must type exactly to enable the destructive action. */
  confirmText?: string;
  consequences: string[];
  payload?: Record<string, unknown>;
  /** Extra form fields rendered above the reason field (e.g. pricing editor). */
  extraFields?: React.ReactNode;
  /** Disable submit until caller-side field validation passes. */
  disableSubmit?: boolean;
  onCreated?: (commandId: string) => void;
}

/**
 * Controlled command intake (docs/04 §4.3 Actions tab, docs/07 §7):
 * typed confirmation + mandatory reason → POST /api/v1/commands with an
 * Idempotency-Key → server acknowledges before the dialog closes.
 */
export function CommandDialog({
  open, onOpenChange, commandType, targetType, targetId, targetLabel,
  confirmText, consequences, payload, extraFields, disableSubmit, onCreated,
}: CommandDialogProps) {
  const spec = COMMAND_TYPES[commandType];
  const router = useRouter();
  const { toast } = useToast();
  const [reason, setReason] = React.useState("");
  const [typed, setTyped] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const typedOk = !confirmText || typed.trim() === confirmText;
  const canSubmit = !!spec && reason.trim().length >= 8 && typedOk && !loading && !disableSubmit;

  React.useEffect(() => {
    if (open) { setReason(""); setTyped(""); setError(null); }
  }, [open]);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/commands", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
          "X-Admin-Request": "1",
        },
        body: JSON.stringify({
          commandType, targetType, targetId,
          payload: { reason: reason.trim(), ...payload },
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
      }
      const commandId = body?.data?.id as string | undefined;
      toast("success", `${spec?.label ?? "Command"} submitted`, spec?.secondApproval
        ? "Awaiting approval from a second administrator."
        : "Accepted by the server.");
      onOpenChange(false);
      onCreated?.(commandId ?? "");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert aria-hidden className="h-4 w-4 text-warning" />
            {spec?.label ?? commandType}
          </DialogTitle>
          <DialogDescription>
            Target: <strong>{targetLabel}</strong> <span className="font-mono text-xs">({targetId})</span>
            {spec?.secondApproval ? " · requires second approval" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-border bg-surface-muted p-3">
            <p className="text-xs font-medium">This action will:</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {consequences.map((c) => <li key={c}>{c}</li>)}
              <li>Create an immutable audit entry with your name attached.</li>
            </ul>
          </div>

          <Field label="Reason (required, min 8 chars)">
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this action is being taken…"
            />
          </Field>

          {extraFields}

          {confirmText ? (
            <Field label={`Type "${confirmText}" to confirm`} error={typed && !typedOk ? "Confirmation text does not match." : null}>
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={confirmText} autoComplete="off" />
            </Field>
          ) : null}

          {error ? <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button variant={spec?.secondApproval ? "destructive" : "default"} onClick={submit} disabled={!canSubmit} loading={loading}>
              Submit command
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
