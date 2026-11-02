import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const supabase = await createClient();
  const { error: auditError } = await supabase.rpc("record_admin_access", { p_action: "auth.logout" });
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) return NextResponse.json({ error: { message: "Signout failed." } }, { status: 503 });
  const store = await cookies();
  store.delete("odt_admin_session");
  return NextResponse.json({ data: { ok: true, auditRecorded: !auditError } });
}
