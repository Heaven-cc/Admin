"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { emailSession } from "@/lib/supabase/email-session";
export function InviteForm() {
 const router=useRouter();
 const [name,setName]=React.useState(""),[password,setPassword]=React.useState(""),[confirmation,setConfirmation]=React.useState(""),[loading,setLoading]=React.useState(false),[error,setError]=React.useState<string|null>(null);
 React.useEffect(()=>{
  let current=true;
  emailSession().catch(error=>{if(current)setError(error instanceof Error?error.message:"Open your newest invitation email in this browser.");});
  return ()=>{current=false;};
 },[]);
 async function accept(e:React.FormEvent) {
  e.preventDefault(); setLoading(true); setError(null);
  try {
   if(password!==confirmation) throw new Error("Passwords do not match.");
   const {sb}=await emailSession();
   const {data:state,error:stateError}=await sb.rpc("admin_login_state");
   if(stateError||!state?.invited||state.active) throw new Error("A valid unused invitation is required.");
   const {error}=await sb.auth.updateUser({password,data:{full_name:name}}); if(error) throw error;
   router.replace("/mfa?next=/overview"); router.refresh();
  } catch(e) {setError(e instanceof Error?e.message:"Invitation could not be accepted.");setLoading(false);}
 }
 return <div className="space-y-4 rounded-lg border border-border bg-surface p-6 shadow-sm">
  <h1 className="text-lg font-semibold">Accept your admin invitation</h1>
  <form onSubmit={accept} className="space-y-4">
  <p className="text-xs text-muted-foreground">Open the button in your newest invitation email in this browser, then set your password and enroll an authenticator.</p>
  <Field label="Full name"><Input required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)} autoComplete="name" /></Field>
  <Field label="New password (at least 12 characters)"><Input required type="password" minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" /></Field>
  <Field label="Confirm password"><Input required type="password" minLength={12} value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="new-password" /></Field>
  {error?<p role="alert" className="text-xs text-danger">{error}</p>:null}
  <Button type="submit" className="w-full" loading={loading}>Set password and enroll MFA</Button>
  </form>
  <a href="/login?next=/mfa" className="block text-xs text-brand">Already set your password? Sign in to finish MFA</a>
 </div>;
}
