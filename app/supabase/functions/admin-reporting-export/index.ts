import { service, reply, equal, signature } from "../_shared/reporting.ts";
Deno.serve(async req => {
  if (req.method !== "POST") return reply(405, { error: "METHOD_NOT_ALLOWED" });
  const sb = service();
  const { data: config, error } = await sb.rpc("trexven_admin_reporting_credentials");
  if (error || !config?.enabled || !await equal(req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "", config.token ?? "")) return reply(401, { error: "UNAUTHORIZED" });
  const input = await req.json().catch(() => null);
  if (!Number.isSafeInteger(input?.offset) || input.offset < 0 || input.limit !== 100) return reply(400, { error: "INVALID_PAGE" });
  const { data, error: failure } = await sb.rpc("trexven_admin_reporting_snapshot", { p_offset: input.offset, p_limit: 100 });
  if (failure) return reply(503, { error: "SOURCE_UNAVAILABLE" });
  const body = JSON.stringify(data);
  if (new TextEncoder().encode(body).byteLength > 4_194_304) return reply(413, { error: "PAGE_TOO_LARGE" });
  return new Response(body, { headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Reporting-Signature": await signature(body, config.token) } });
});
