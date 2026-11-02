import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getDataProvider } from "@/lib/data";

/** CSV export (docs/04 §4.14) — the export itself is audited (FR-973). */
export async function GET(req: Request) {
  const auth = await requireApiSession("audit.export");
  if ("error" in auth) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Requires audit.export." } }, { status: auth.error === "unauthenticated" ? 401 : 403 });
  }
  const url = new URL(req.url);
  const q = {
    actor: url.searchParams.get("actor") ?? undefined,
    action: url.searchParams.get("action") ?? undefined,
    resourceType: url.searchParams.get("resourceType") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  };
  const { entries } = await getDataProvider().getAudit(q);
  { const sb=await createClient(); const {error}=await sb.rpc("record_admin_access",{p_action:"audit.export"}); if(error)return NextResponse.json({error:{message:"Export audit could not be recorded."}},{status:503}); }
  const csvCell = (v: unknown) => { const raw=String(v ?? ""); return '"' + (/^[\s]*[=+@-]/.test(raw) ? "'" + raw : raw).replace(/"/g,'""') + '"'; };
  const header = "occurred_at,actor,actor_role,action,resource_type,resource_id,request_id";
  const lines = entries.map((e) =>
    [e.occurredAt, e.actorName, e.actorRole, e.action, e.resourceType, e.resourceId, e.requestId]
      .map(csvCell)
      .join(",")
  );
  return new NextResponse([header, ...lines].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="audit-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
