import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth/session";
import { getMutationBackend } from "@/lib/data";
const schema=z.object({title:z.string().trim().min(4).max(200),severity:z.enum(["S1","S2","S3","S4"]),services:z.array(z.string().trim().min(1).max(80)).max(10).default([]),note:z.string().trim().max(4000).optional()}).strict();
export async function POST(req:Request){
 const auth=await requireApiSession("incidents.manage");if("error" in auth)return NextResponse.json({error:{message:"Incident management permission required."}},{status:auth.error==="unauthenticated"?401:403});
 const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:{message:"Provide a title (4-200 characters), severity, and up to 10 services."}},{status:400});
 try{const data=await getMutationBackend().createIncident({...parsed.data,note:parsed.data.note||undefined},{userId:auth.session.userId,name:auth.session.name,role:auth.session.role});return NextResponse.json({data},{status:201});}catch{return NextResponse.json({error:{message:"Incident could not be saved."}},{status:409});}
}
