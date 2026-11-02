import { service, scoped, reply, equal, signature } from "../_shared/reporting.ts";
Deno.serve(async req => {
  if (req.method !== "POST") return reply(405, { error: "METHOD_NOT_ALLOWED" });
  const sb = service();
  const { data: config, error } = await sb.rpc("admin_pipeline_credentials");
  if (error || !config?.enabled || !config.export_token || config.export_url !== "https://ufehcfrlygqvminfjumf.supabase.co/functions/v1/admin-reporting-export") return reply(503, { error: "PIPELINE_DISABLED" });
  const cron = await equal(req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "", config.cron_token ?? "");
  if (!cron) {
    const user = scoped(req), { data: identity } = await user.auth.getUser();
    const { data: session } = await user.rpc("admin_session");
    if (!identity.user || !session?.permissions?.includes("health.manage_sync")) return reply(403, { error: "FORBIDDEN" });
    const { error: requested } = await user.rpc("admin_request_sync");
    if (requested) return reply(403, { error: "FORBIDDEN" });
  }
  const { data: run, error: startError } = await sb.rpc("admin_start_sync");
  if (startError) return reply(503, { error: "SYNC_START_FAILED" });
  if (!run) return reply(202, { status: "leased_or_backoff" });
  try {
    let offset: number = run.offset;
    for (let page = 0; page < 5 && offset !== -1; page++) {
      const res = await fetch(config.export_url, { method: "POST", headers: { Authorization: "Bearer " + config.export_token, "Content-Type": "application/json" }, body: JSON.stringify({ offset, limit: 100 }), signal: AbortSignal.timeout(20_000), redirect: "error" });
      if (!res.ok || Number(res.headers.get("Content-Length") ?? 0) > 4_194_304) throw new Error("SOURCE_UNAVAILABLE");
      const body = await res.text();
      if (new TextEncoder().encode(body).byteLength > 4_194_304 || !await equal(res.headers.get("X-Reporting-Signature") ?? "", await signature(body, config.export_token))) throw new Error("SIGNATURE_INVALID");
      const snapshot = JSON.parse(body);
      const { data: receipt, error: failed } = await sb.rpc("admin_apply_reporting_page", { p_cycle: run.cycle_id, p_snapshot: snapshot });
      if (failed) { console.error("REPORTING_RECEIVER", failed.code, failed.message); throw new Error("RECEIVER_REJECTED_" + failed.code); }
      if (receipt.next_offset !== -1 && receipt.next_offset <= offset) throw new Error("CHECKPOINT_INVALID");
      offset = receipt.next_offset;
    }
    if (offset === -1) {
      const { error: failed } = await sb.rpc("admin_finish_sync", { p_cycle: run.cycle_id, p_success: true });
      if (failed) { console.error("REPORTING_FINISH",failed.code,failed.message); throw new Error("RECONCILIATION_FAILED"); }
    }
    return reply(200, { status: offset === -1 ? "completed" : "checkpointed", cycle_id: run.cycle_id });
  } catch (e) {
    const allowed = ["SOURCE_UNAVAILABLE", "SIGNATURE_INVALID", "RECEIVER_REJECTED", "CHECKPOINT_INVALID", "RECONCILIATION_FAILED"];
    const code = e instanceof Error && (allowed.includes(e.message) || /^RECEIVER_REJECTED_[A-Z0-9]{5}$/.test(e.message)) ? e.message : "SYNC_FAILED";
    await sb.rpc("admin_finish_sync", { p_cycle: run.cycle_id, p_success: false, p_error_code: code });
    return reply(503, { error: code, cycle_id: run.cycle_id });
  }
});
