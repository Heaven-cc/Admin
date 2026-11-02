import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function GET(req: Request) {
 const url=new URL(req.url),sb=await createClient(),type=url.searchParams.get("type"),hash=url.searchParams.get("token_hash"),code=url.searchParams.get("code");
 if(code){const {error}=await sb.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(type==="recovery"?"/reset?step=change":"/invite/accept",url.origin));}
 else if(hash&&(type==="invite"||type==="recovery")){const {error}=await sb.auth.verifyOtp({token_hash:hash,type});if(!error)return NextResponse.redirect(new URL(type==="invite"?"/invite/accept":"/reset?step=change",url.origin));}
 return NextResponse.redirect(new URL("/login?error=invalid_link",url.origin));
}
