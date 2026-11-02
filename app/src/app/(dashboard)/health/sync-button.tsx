"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export function SyncButton(){const router=useRouter();const [busy,setBusy]=React.useState(false),[message,setMessage]=React.useState<string|null>(null);
return <div><Button variant="outline" loading={busy} onClick={async()=>{setBusy(true);setMessage(null);try{const r=await fetch("/api/v1/health/sync",{method:"POST",headers:{"X-Admin-Request":"1"}});const b=await r.json();if(!r.ok)throw new Error(b.error?.message??"Sync unavailable.");setMessage(b.data.status==="completed"?"Reporting sync completed.":b.data.status==="checkpointed"?"Page checkpoint saved; the schedule will continue.":"A sync is already running or waiting for retry.");router.refresh();}catch(e){setMessage(e instanceof Error?e.message:"Sync unavailable.");}finally{setBusy(false);}}}>Refresh production reporting</Button>{message?<p role="status" className="mt-2 max-w-sm text-xs text-muted-foreground">{message}</p>:null}</div>;}
