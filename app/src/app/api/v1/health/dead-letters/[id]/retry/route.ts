import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { getMutationBackend } from "@/lib/data";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession("health.manage_sync");
  if ("error" in auth) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Requires health.manage_sync (Technical Admin)." } }, { status: auth.error === "unauthenticated" ? 401 : 403 });
  }
  const { id } = await params;
  try {
    await getMutationBackend().retryDeadLetter(id, {
      userId: auth.session.userId, name: auth.session.name, role: auth.session.role,
    });
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: err instanceof Error ? err.message : "Retry failed." } },
      { status: 409 }
    );
  }
}
