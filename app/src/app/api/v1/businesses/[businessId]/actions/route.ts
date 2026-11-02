import { NextResponse } from "next/server";
import { z } from "zod";
import { can, requireApiSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const actionInput = z.object({
  id: z.string().uuid(), action: z.enum(["suspend", "restore", "delete"]),
  reason: z.string().trim().min(8).max(2000), confirmation: z.string().min(1).max(300),
}).strict();
const messages: Record<string, string> = {
  FRESH_MFA_REQUIRED: "Verify a fresh authenticator code before deleting the business.",
  ACTION_NOT_AUTHORIZED: "Your current role or confirmation does not authorize this action.",
  FORBIDDEN: "Your current administrator session does not authorize this action.",
  BUSINESS_CHANGED: "The business name changed. Refresh the profile and confirm its current name.",
  BUSINESS_NOT_FOUND: "The production business is no longer available.",
  DELETE_IN_PROGRESS: "Deletion has already started. Refresh the profile to continue it.",
  CROSS_BUSINESS_REFERENCE: "Unexpected links to another business prevent safe deletion. The remaining database records have been retained.",
  MEDIA_CLEANUP_RETRY: "Media cleanup could not finish. The business remains disabled; retry deletion to continue.",
  DATABASE_DELETE_RETRY: "Deletion could not finish. The business remains disabled; retry deletion to continue.",
  AUTHORIZATION_EXPIRED: "Your authorization expired while deleting. Sign in and verify MFA again to continue.",
  RECEIPT_RECORDING_RETRY: "Production responded, but its result could not be recorded. Retry the same action to recover its receipt.",
};

export async function POST(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const headers = { "Cache-Control": "no-store" };
  const fail = (status: number, code: string) => NextResponse.json({ error: { code, message: messages[code] ?? "The action could not complete. Retry to recover its production status." } }, { status, headers });
  const auth = await requireApiSession();
  if ("error" in auth) return fail(401, "UNAUTHENTICATED");
  const { businessId } = await params;
  const input = actionInput.safeParse(await request.json().catch(() => null));
  if (!z.string().uuid().safeParse(businessId).success || !input.success) return fail(400, "INVALID_ACTION");
  const permission = input.data.action === "delete" ? "businesses.delete" : input.data.action === "suspend" ? "businesses.suspend" : "businesses.restore";
  if (!can(auth.session, permission) || (input.data.action === "delete" && auth.session.role !== "super_admin")) return fail(403, "FORBIDDEN");
  if (process.env.ADMIN_BUSINESS_CONTROLS_ENABLED !== "true") return NextResponse.json({ error: { code: "PRODUCTION_CONFIGURATION_PENDING", message: "Business controls are waiting for the production backend configuration to be approved and applied." } }, { status: 423, headers });
  const sb = await createClient();
  const { data, error } = await sb.functions.invoke("business-admin-action", { body: { ...input.data, business_ref: businessId } });
  if (error) {
    const body = error.context instanceof Response ? await error.context.json().catch(() => null) : null;
    const code = typeof body?.error === "string" ? body.error : "PRODUCTION_UNAVAILABLE";
    return fail(["FRESH_MFA_REQUIRED", "ACTION_NOT_AUTHORIZED", "FORBIDDEN"].includes(code) ? 403 : 503, code);
  }
  if (!data || data.business_ref !== businessId || data.action !== input.data.action || typeof data.finished !== "boolean") return fail(503, "INVALID_RECEIPT");
  return NextResponse.json({ data: { ...data, message: data.error_code ? messages[data.error_code] ?? "Deletion is incomplete. Retry to continue." : undefined } }, { status: data.finished ? 200 : 202, headers });
}
