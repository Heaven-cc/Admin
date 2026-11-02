"use client";
import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
export function MfaForm({ nextPath }: { nextPath: string }) {
 const router = useRouter();
 const [factor, setFactor] = React.useState<string | null>(null), [qr, setQr] = React.useState<string | null>(null), [secret, setSecret] = React.useState<string | null>(null);
 const [code, setCode] = React.useState(""), [name, setName] = React.useState(""), [invited, setInvited] = React.useState(false), [loading, setLoading] = React.useState(false), [error, setError] = React.useState<string | null>(null);
 async function prepare() {
  setLoading(true); setError(null);
  try {
   const sb = createClient(), { data: state, error: stateError } = await sb.rpc("admin_login_state");
   if (stateError || !state || (!state.active && !state.invited)) throw new Error("No active administrator or valid invitation exists. Contact your Super Admin.");
   setInvited(state.invited); const { data: identity } = await sb.auth.getUser(); setName(typeof identity.user?.user_metadata?.full_name === "string" ? identity.user.user_metadata.full_name : state.name ?? "");
   const { data, error } = await sb.auth.mfa.listFactors(); if (error) throw error;
   const existing = data.totp.find(f => f.status === "verified");
   if (existing) { setFactor(existing.id); return; }
   for (const old of data.all.filter(f => f.status === "unverified")) { const { error } = await sb.auth.mfa.unenroll({ factorId: old.id }); if (error) throw error; }
   const enrolled = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "TREXVEN Admin " + new Date().toISOString() });
   if (enrolled.error) throw enrolled.error;
   setFactor(enrolled.data.id); setQr(enrolled.data.totp.qr_code); setSecret(enrolled.data.totp.secret);
  } catch(e) { setError(e instanceof Error ? e.message : "Authenticator setup unavailable."); }
  finally { setLoading(false); }
 }
 async function verify(e: React.FormEvent) {
  e.preventDefault(); if (!factor) return; setLoading(true); setError(null);
  try {
   const sb = createClient();
   const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: factor, code }); if (error) throw error;
   if (invited) { const { error } = await sb.rpc("admin_activate_invitation", { p_name: name }); if (error) throw new Error("Invitation activation failed. Check that the invitation has not expired."); }
   const { data: session, error: denied } = await sb.rpc("admin_session");
   if (denied || !session) throw new Error("Administrator access is unavailable or this session has expired. Sign in again.");
   const { error: audit } = await sb.rpc("record_admin_access", { p_action: "auth.login" }); if (audit) throw new Error("Sign-in audit could not be recorded.");
   setQr(null); setSecret(null); router.replace(nextPath); router.refresh();
  } catch(e) { setError(e instanceof Error ? e.message : "Verification failed."); setLoading(false); }
 }
 return <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
  <h1 className="text-lg font-semibold">Two-factor authentication</h1>
  <p className="mt-2 text-xs text-muted-foreground">Use an authenticator app to secure your administrator account.</p>
  {!factor ? <Button className="mt-4 w-full" loading={loading} onClick={prepare}>Continue with authenticator</Button> : <form onSubmit={verify} className="mt-4 space-y-4">
   {qr ? <div><p className="text-xs">Scan this QR code with your authenticator. Keep the setup key private.</p>{/* Auth-generated SVG stays in an image, never injected as HTML. */}<Image unoptimized width={192} height={192} src={qr.startsWith("data:") ? qr : "data:image/svg+xml;charset=utf-8," + encodeURIComponent(qr)} alt="Authenticator enrollment QR code" className="mx-auto h-48 w-48 bg-white" /><details className="break-all text-xs"><summary>Manual setup key</summary><code>{secret}</code></details></div> : null}
   {invited ? <Field label="Full name"><Input required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)} /></Field> : null}
   <Field label="Six-digit authentication code"><Input required pattern="[0-9]{6}" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g, "").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" /></Field>
   <Button type="submit" className="w-full" loading={loading} disabled={code.length!==6}>Verify and continue</Button>
  </form>}
  {error ? <p role="alert" className="mt-3 text-xs text-danger">{error}</p> : null}
  <a href="/login" className="mt-4 block text-xs text-brand">Return to sign in</a>
 </div>;
}
