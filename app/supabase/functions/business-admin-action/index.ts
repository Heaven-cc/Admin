import { service, scoped, reply } from "../_shared/reporting.ts";
const uuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
Deno.serve(async req=>{
 if(req.method!=="POST")return reply(405,{error:"METHOD_NOT_ALLOWED"});
 const user=scoped(req),{data:identity,error:identityError}=await user.auth.getUser();
 if(identityError||!identity.user)return reply(401,{error:"UNAUTHORIZED"});
 const input=await req.json().catch(()=>null);
 if(!input||Object.keys(input).some(k=>!["id","business_ref","action","reason","confirmation"].includes(k))||
 typeof input.id!=="string"||!uuid.test(input.id)||typeof input.business_ref!=="string"||!uuid.test(input.business_ref)||
 !["suspend","restore","delete"].includes(input.action)||typeof input.reason!=="string"||input.reason.trim().length<8||input.reason.length>2000||typeof input.confirmation!=="string"||input.confirmation.length>300)return reply(400,{error:"INVALID_ACTION"});
 const {data:id,error:denied}=await user.rpc("admin_begin_business_action",{p_id:input.id,p_business:input.business_ref,p_action:input.action,p_reason:input.reason,p_confirmation:input.confirmation});
 if(denied||!id)return reply(denied?.code==="42501"?403:409,{error:denied?.message==="FRESH_MFA_REQUIRED"?"FRESH_MFA_REQUIRED":"ACTION_NOT_AUTHORIZED"});
 const {data:prior}=await user.from("admin_business_actions").select("status,result,requested_by").eq("id",id).single();
 if(prior?.requested_by===identity.user.id&&prior.status==="completed"&&prior.result)return reply(200,prior.result);
 let response:Response;
 try{
  response=await fetch("https://ufehcfrlygqvminfjumf.supabase.co/functions/v1/admin-business-control",{
   method:"POST",headers:{"Content-Type":"application/json",Authorization:req.headers.get("Authorization")??""},
   body:JSON.stringify({action_id:id}),signal:AbortSignal.timeout(100_000)
  });
 }catch{return reply(503,{error:"PRODUCTION_UNAVAILABLE",id});}
 const receipt=await response.json().catch(()=>null);
 if(!response.ok||!receipt||receipt.id!==id||receipt.business_ref!==input.business_ref||receipt.action!==input.action)return reply(response.status===403?403:503,{error:typeof receipt?.error==="string"?receipt.error:"PRODUCTION_ACTION_FAILED",id});
 const sb=service(),{error:saveError}=await sb.rpc("admin_finish_business_action",{p_id:id,p_result:receipt});
 if(saveError)return reply(503,{error:"RECEIPT_RECORDING_RETRY",id});
 return reply(receipt.finished?200:202,receipt);
});
