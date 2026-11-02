import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
export async function POST() {
 const auth=await requireApiSession("health.manage_sync");if("error" in auth)return NextResponse.json({error:{message:"Sync management permission required."}},{status:auth.error==="unauthenticated"?401:403});
 const sb=await createClient(),{data,error}=await sb.functions.invoke("sync-production",{body:{}});
 if(error)return NextResponse.json({error:{message:"Sync did not complete. Review the latest pipeline status."}},{status:503});return NextResponse.json({data});
}
