export interface RuntimeConfig { mode: "supabase" | "unconfigured"; url?: string; key?: string }
export function runtimeConfig(env = process.env): RuntimeConfig {
  const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url && !key) return { mode: "unconfigured" };
  if (!url || !key) throw new Error("Both Admin Supabase URL and publishable key are required.");
  const parsed = new URL(url), local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (parsed.username || parsed.password || parsed.search || parsed.hash || !["", "/"].includes(parsed.pathname)) throw new Error("Invalid Admin Supabase URL.");
  if (!local && (parsed.protocol !== "https:" || parsed.hostname !== "tsnkzkpgxvomfuzyeyup.supabase.co" || env.ADMIN_SUPABASE_PROJECT_REF !== "tsnkzkpgxvomfuzyeyup")) throw new Error("Only the separate approved Admin project or localhost is permitted.");
  if (local && !["http:", "https:"].includes(parsed.protocol)) throw new Error("Invalid local protocol.");
  if (key.startsWith("sb_secret_")) throw new Error("Secret keys must never be public.");
  if (key.split(".").length === 3) {
    try { const claims = JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); if (claims.role !== "anon") throw new Error(); }
    catch { throw new Error("Invalid public API key."); }
  } else if (!key.startsWith("sb_publishable_")) throw new Error("A Supabase publishable or anon key is required.");
  return { mode: "supabase", url, key };
}
