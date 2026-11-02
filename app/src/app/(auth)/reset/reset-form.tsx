"use client";
import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { emailSession } from "@/lib/supabase/email-session";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function ResetForm() {
  const params = useSearchParams(), router = useRouter(), change = params.get("step") === "change";
  const [email, setEmail] = React.useState(""), [password, setPassword] = React.useState(""), [confirmation, setConfirmation] = React.useState("");
  const [busy, setBusy] = React.useState(false), [message, setMessage] = React.useState<string | null>(null), [error, setError] = React.useState<string | null>(null);
  const [retryAt, setRetryAt] = React.useState(0);
  React.useEffect(() => {
    let current = true;
    if (change) emailSession().then(async ({sb}) => {
      const {data:state,error} = await sb.rpc("admin_login_state");
      if(error) throw new Error("Administrator access could not be checked. Please try again.");
      if(current && state?.invited && !state.active) router.replace("/invite/accept");
    }).catch(error => { if (current) setError(error instanceof Error ? error.message : "Open your newest recovery email in this browser."); });
    return () => { current = false; };
  }, [change, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(null); setMessage(null);
    try {
      if (change) {
        if (password !== confirmation) throw new Error("Passwords do not match.");
        const { sb } = await emailSession();
        const { data: state, error: stateError } = await sb.rpc("admin_login_state");
        if (stateError) throw new Error("Administrator access could not be checked. Please try again.");
        if (state?.invited && !state.active) { router.replace("/invite/accept"); return; }
        if (!state?.active) throw new Error("An active administrator account or valid invitation is required.");
        const assurance = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
        if (assurance.error) throw assurance.error;
        if (assurance.data.currentLevel !== "aal2") {
          router.replace("/mfa?next=" + encodeURIComponent("/reset?step=change")); return;
        }
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw error;
        const { error: revocation } = await sb.auth.signOut({ scope: "others" });
        if (revocation) throw new Error("Password changed; other sessions could not be revoked. Contact your administrator.");
        setPassword(""); setConfirmation(""); setMessage("Password changed. Other refresh sessions have been revoked.");
      } else {
        if (Date.now() < retryAt) throw new Error("Please wait at least a minute before requesting another email.");
        const result = await fetch("/api/v1/auth/recovery", {
          method:"POST", headers:{"Content-Type":"application/json","X-Admin-Request":"1"},
          body:JSON.stringify({email:email.trim()}),
        });
        const response = await result.json().catch(()=>null);
        setRetryAt(Date.now() + 60_000);
        if(!result.ok) throw new Error(response?.error ?? "The recovery email could not be requested.");
        setMessage("If this email has an account, a recovery email has been sent. Keep this page open, then open the newest email button directly in this browser.");
      }
    } catch (error) { setError(error instanceof Error ? error.message : "Recovery unavailable."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-4 rounded-lg border border-border bg-surface p-6">
    <h1 className="text-lg font-semibold">{change ? "Set a new password" : "Recover your password"}</h1>
    <form onSubmit={submit} className="space-y-4">
      {change ? <>
        <Field label="New password (at least 12 characters)"><Input required type="password" minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" /></Field>
        <Field label="Confirm password"><Input required type="password" minLength={12} value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="new-password" /></Field>
      </> : <Field label="Administrator email"><Input required type="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></Field>}
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
      {message ? <p role="status" className="text-xs">{message}</p> : null}
      <Button type="submit" loading={busy} className="w-full">{change ? "Change password" : "Request recovery email"}</Button>
    </form>
    {!change ? <a href="/reset?step=change" className="block text-xs text-brand">Already have a setup email? Continue here</a> : null}
    <a href="/login" className="block text-xs text-brand">Return to sign in</a>
  </div>;
}
