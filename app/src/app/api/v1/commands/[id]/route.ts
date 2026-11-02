import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { getDataProvider } from "@/lib/data";

/** Poll target for CommandStatusCard (docs/04 §4.16). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiSession("commands.read");
  if ("error" in auth) {
    const code = auth.error === "unauthenticated" ? "UNAUTHENTICATED" : "FORBIDDEN";
    return NextResponse.json({ error: { code, message: "Not permitted." } }, { status: auth.error === "unauthenticated" ? 401 : 403 });
  }
  const { id } = await params;
  const command = await getDataProvider().getCommand(id);
  if (!command) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Command not found." } }, { status: 404 });
  }
  return NextResponse.json({ data: command });
}
