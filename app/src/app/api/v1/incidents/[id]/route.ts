import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth/session";
import { getMutationBackend } from "@/lib/data";
const schema=z.object({status:z.enum(["open","investigating","mitigated","resolved","closed"]).optional(),entry:z.string().trim().min(1).max(4000).optional()}).strict().refine(v=>v.status||v.entry);
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 const auth=await requireApiSession("incidents.manage");if("error" in auth)return NextResponse.json({error:{message:"Incident management permission required."}},{status:auth.error==="unauthenticated"?401:403});
 const {id}=await params,parsed=schema.safeParse(await req.json().catch(()=>null));if(!z.string().uuid().safeParse(id).success||!parsed.success)return NextResponse.json({error:{message:"Provide a valid incident, status or timeline entry (1-4000 characters)."}},{status:400});
 try{await getMutationBackend().updateIncident(id,parsed.data,{userId:auth.session.userId,name:auth.session.name,role:auth.session.role});return NextResponse.json({data:{ok:true}});}catch{return NextResponse.json({error:{message:"Incident update was rejected. Check its current status."}},{status:409});}
}
