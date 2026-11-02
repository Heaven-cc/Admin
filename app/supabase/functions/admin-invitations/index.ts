import { service, scoped, reply, equal } from "../_shared/reporting.ts";
Deno.serve(async req => {
  if (req.method !== "POST") return reply(405, { error: "METHOD_NOT_ALLOWED" });
  const sb = service(), input = await req.json().catch(() => null);
  const { data: config } = await sb.rpc("admin_pipeline_credentials");
  const bootstrap = await equal(req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "", config?.cron_token ?? "");
  let id: string;
  let reservation;
  if (bootstrap) {
    if (typeof input?.reservation_id !== "string") return reply(400, { error: "RESERVATION_REQUIRED" });
    id = input.reservation_id;
    const { data } = await sb.rpc("admin_bootstrap_details", { p_id: id }); reservation = data;
  } else {
    const user = scoped(req), { data: identity } = await user.auth.getUser();
    if (!identity.user) return reply(401, { error: "UNAUTHORIZED" });
    if (typeof input?.email !== "string" || input.email.length > 254 || typeof input?.role !== "string") return reply(400, { error: "INVALID_INVITATION" });
    const { data, error } = await user.rpc("admin_reserve_invite", { p_email: input.email.trim().toLowerCase(), p_role: input.role });
    if (error || !data) return reply(409, { error: "INVITATION_NOT_RESERVED" });
    id = data;
    const { data: details } = await sb.rpc("admin_invite_details", { p_id: id }); reservation = details;
  }
  if (!reservation) return reply(403, { error: "RESERVATION_UNAVAILABLE" });
  // This redirect is fixed by the server; callers cannot substitute a token-harvesting URL.
  let userId = reservation.auth_user_id;
  if (userId) {
    const { error } = await sb.auth.resetPasswordForEmail(reservation.email, { redirectTo: "http://localhost:3000/invite/accept" });
    if (error) { await sb.rpc("admin_invitation_failed", { p_id: id }); return reply(502, { error: "EMAIL_INVITATION_FAILED" }); }
  } else {
    const { data: invited, error } = await sb.auth.admin.inviteUserByEmail(reservation.email, { redirectTo: "http://localhost:3000/invite/accept" });
    if (error || !invited.user) { await sb.rpc("admin_invitation_failed", { p_id: id }); return reply(502, { error: "EMAIL_INVITATION_FAILED" }); }
    userId = invited.user.id;
  }
  const { error: failed } = await sb.rpc("admin_complete_invite", { p_id: id, p_user_id: userId });
  if (failed) return reply(503, { error: "PROFILE_PROVISIONING_FAILED" });
  return reply(201, { id, status: "invited" });
});
