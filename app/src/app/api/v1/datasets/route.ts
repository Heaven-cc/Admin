import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
const schema = z.object({ name: z.string().trim().min(3).max(160), slug: z.string().regex(/^[a-z0-9][a-z0-9-]{2,79}$/), domain: z.enum(["vision","intelligence","sales","angel"]), basis: z.string().trim().min(8).max(2000), retention: z.string().trim().min(8).max(2000), checksum: z.string().regex(/^[a-f0-9]{64}$/), rows: z.number().int().nonnegative().safe(), bytes: z.number().int().nonnegative().safe() }).strict();
export async function POST(req: Request) {
 const auth = await requireApiSession("ai_data.manage"); if ("error" in auth) return NextResponse.json({ error: { message: "Dataset management permission required." } }, { status: auth.error === "unauthenticated" ? 401 : 403 });
 const parsed = schema.safeParse(await req.json().catch(()=>null)); if (!parsed.success) return NextResponse.json({ error: { message: "Invalid dataset metadata." } }, { status: 400 });
 const i = parsed.data, sb = await createClient(); const { data, error } = await sb.rpc("admin_dataset_register", { p_name:i.name,p_slug:i.slug,p_domain:i.domain,p_basis:i.basis,p_retention:i.retention,p_checksum:i.checksum,p_rows:i.rows,p_bytes:i.bytes });
 if (error) return NextResponse.json({ error: { message: "Dataset could not be registered. Check the slug and metadata." } }, { status:409 });
 return NextResponse.json({data:{id:data}},{status:201});
}
