import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
export async function POST() {
 const auth = await requireApiSession();
 if ("error" in auth) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required." } }, { status: 401 });
 return NextResponse.json({ error: { code: "COMMAND_DISABLED", message: "Commands await approved production execution contracts." } }, { status: 423 });
}
