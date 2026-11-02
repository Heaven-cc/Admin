import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { getMutationBackend } from "@/lib/data";

export async function POST() {
  const auth = await requireApiSession();
  if ("error" in auth) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required." } }, { status: 401 });
  }
  try {
    await getMutationBackend().markNotificationsRead();
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "INTERNAL", message: err instanceof Error ? err.message : "Failed." } },
      { status: 500 }
    );
  }
}
