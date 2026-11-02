import { NextResponse } from "next/server";
import { z } from "zod";
import { ROLES } from "@/lib/auth/permissions";
import { requireApiSession } from "@/lib/auth/session";
import { getMutationBackend } from "@/lib/data";
const schema=z.object({email:z.string().trim().email().max(254).transform(v=>v.toLowerCase()),role:z.enum(ROLES)}).strict();
export async function POST(req:Request){
 const auth=await requireApiSession("admin_team.invite");if("error" in auth)return NextResponse.json({error:{message:"Administrator invitation permission required."}},{status:auth.error==="unauthenticated"?401:403});
 const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:{message:"Provide a valid email and administrator role."}},{status:400});
 try{const data=await getMutationBackend().inviteAdmin(parsed.data,{userId:auth.session.userId,name:auth.session.name,role:auth.session.role});return NextResponse.json({data},{status:201});}catch{return NextResponse.json({error:{message:"Invitation could not be completed. Existing unused invitations must retain their original role. Check email delivery before retrying."}},{status:409});}
}
