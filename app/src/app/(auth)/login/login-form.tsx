"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { emailSession } from "@/lib/supabase/email-session";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  React.useEffect(() => {
    const query=new URLSearchParams(window.location.search), fragment=new URLSearchParams(window.location.hash.slice(1));
    if(!query.has("code") && !fragment.has("access_token") && !fragment.has("error")) return;
    let current=true;
    emailSession().then(async ({sb})=>{
      const {data:state,error}=await sb.rpc("admin_login_state");
      if(error || (!state?.active && !state?.invited)) throw new Error("An active administrator account or valid invitation is required.");
      if(current){router.replace(state.invited && !state.active ? "/invite/accept" : "/reset?step=change");router.refresh();}
    }).catch(error=>{if(current)setError(error instanceof Error?error.message:"Open your newest recovery email in this browser.");});
    return ()=>{current=false;};
  },[router]);

  async function passwordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw new Error(authError.message);
      const { data: profile, error: profileError } = await supabase.rpc("admin_login_state");
      if (profileError || !profile || (!profile.active && !profile.invited)) { await supabase.auth.signOut(); throw new Error("An active administrator account or valid invitation is required."); }
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error) throw assurance.error;
      if (data.user && assurance.data.currentLevel !== "aal2") {
        router.push("/mfa?next=" + encodeURIComponent(nextPath));
      } else {
        router.push(nextPath);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
      <div className="mb-5 text-center">
        <h1 className="text-lg font-semibold">ODT Admin</h1>
        <p className="mt-1 text-xs text-muted-foreground">Internal platform for the TREXVEN ecosystem</p>
      </div>

        <form onSubmit={passwordLogin} className="space-y-3">
          <Field label="Work email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label="Password">
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
          <Button type="submit" className="w-full" loading={loading}>
            Continue
          </Button>
          <a href="/reset" className="block text-center text-xs text-brand">Forgot password?</a>
          <p className="text-center text-[11px] text-muted-foreground">
            Multi-factor authentication is enforced for all administrators.
          </p>
        </form>

      <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
        <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
        Access is provisioned by your ODT administrator — there is no public registration.
      </p>
    </div>
  );
}
