import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { service, reply } from "../_shared/reporting.ts";
const ADMIN_URL="https://tsnkzkpgxvomfuzyeyup.supabase.co";
const ADMIN_PUBLIC_KEY="sb_publishable_mde-seBGnF_HtV6AEHKKbA__19yLmuH";
const uuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
Deno.serve(async req=>{
 if(req.method!=="POST")return reply(405,{error:"METHOD_NOT_ALLOWED"});
 const authorization=req.headers.get("Authorization")??"";
 if(!authorization.startsWith("Bearer "))return reply(401,{error:"UNAUTHORIZED"});
 const admin=createClient(ADMIN_URL,ADMIN_PUBLIC_KEY,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:identity,error:identityError}=await admin.auth.getUser();
 if(identityError||!identity.user)return reply(401,{error:"UNAUTHORIZED"});
 const input=await req.json().catch(()=>null);
 if(!input||Object.keys(input).some(k=>k!=="action_id")||typeof input.action_id!=="string"||!uuid.test(input.action_id))return reply(400,{error:"INVALID_ACTION"});
 const authorize=()=>admin.rpc("admin_authorize_business_action",{p_id:input.action_id});
 const {data:intent,error:denied}=await authorize();
 if(denied||!intent||intent.actor_id!==identity.user.id)return reply(403,{error:"FORBIDDEN"});
 const sb=service();
 const {data:receipt,error:prepareError}=await sb.rpc("trexven_admin_business_prepare",{p_intent:intent});
 if(prepareError||!receipt){
  const allowed=["BUSINESS_NOT_FOUND","BUSINESS_CHANGED","IDEMPOTENCY_CONFLICT","DELETE_IN_PROGRESS","CROSS_BUSINESS_REFERENCE"];
  return reply(409,{error:allowed.includes(prepareError?.message??"")?prepareError!.message:"PRODUCTION_ACTION_REJECTED"});
 }
 if(receipt.finished)return reply(200,receipt);
 const progress=(error_code:string)=>reply(202,{...receipt,state:"deleting",finished:false,error_code});
 const {data:objects,error:manifestError}=await sb.rpc("trexven_admin_business_objects",{p_id:input.action_id});
 if(manifestError||!Array.isArray(objects))return progress("MEDIA_MANIFEST_UNAVAILABLE");
 const groups=new Map<string,string[]>();
 for(const file of objects){
  if(typeof file.bucket!=="string"||typeof file.name!=="string")return progress("MEDIA_MANIFEST_INVALID");
  groups.set(file.bucket,[...(groups.get(file.bucket)??[]),file.name]);
 }
 for(const [bucket,names] of groups){
  const {error}=await sb.storage.from(bucket).remove(names);
  if(error)return progress("MEDIA_CLEANUP_RETRY");
 }
 // Recheck the actual Admin session/role immediately before the database purge.
 const {data:stillAllowed,error:revoked}=await authorize();
 if(revoked||!stillAllowed||stillAllowed.action!=="delete"||stillAllowed.actor_role!=="super_admin")return progress("AUTHORIZATION_EXPIRED");
 const {data:result,error:finishError}=await sb.rpc("trexven_admin_business_finalize",{p_id:input.action_id});
 if(finishError||!result)return progress(finishError?.message==="CROSS_BUSINESS_REFERENCE"?"CROSS_BUSINESS_REFERENCE":"DATABASE_DELETE_RETRY");
 return reply(result.finished?200:202,result);
});
