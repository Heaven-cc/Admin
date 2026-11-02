import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
const schema=z.object({country:z.enum(["NG","GH","TG","CI"]),plan:z.enum(["start","core","pro"]),minor:z.number().int().nonnegative().safe(),effective:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).strict();
export async function POST(req:Request) {
 const auth=await requireApiSession("pricing.update"); if("error" in auth)return NextResponse.json({error:{message:"Pricing permission required."}},{status:auth.error==="unauthenticated"?401:403});
 const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:{message:"Invalid country price."}},{status:400});
 const i=parsed.data,sb=await createClient(),{data,error}=await sb.rpc("admin_price_draft",{p_country:i.country,p_plan:i.plan,p_minor:i.minor,p_effective:i.effective});
 if(error)return NextResponse.json({error:{message:"Price draft could not be saved. Check its effective date."}},{status:409});return NextResponse.json({data:{id:data}},{status:201});
}
