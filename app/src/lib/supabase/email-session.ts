"use client";
import { createClient } from "./client";

/** Accept Auth-issued email tokens explicitly while retaining PKCE for normal sign-in. */
let pending: ReturnType<typeof acceptEmailSession> | null = null;
export function emailSession() {
  // Share initialization so React remounts cannot discard an in-flight token handoff.
  if (!pending) pending = acceptEmailSession().finally(() => { pending = null; });
  return pending;
}
async function acceptEmailSession() {
  const query = new URLSearchParams(window.location.search);
  const code = query.get("code");
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const access = fragment.get("access_token"), refresh = fragment.get("refresh_token");
  const type = fragment.get("type");
  const linkFailed = fragment.has("error") || fragment.has("error_code") || query.has("error_code");
  // Remove credentials before initializing the PKCE client or navigating elsewhere.
  if (code || access || refresh || linkFailed) {
    query.delete("code"); query.delete("error"); query.delete("error_code"); query.delete("error_description");
    const search = query.toString();
    window.history.replaceState(window.history.state, "", window.location.pathname + (search ? "?" + search : ""));
  }
  const sb = createClient();
  if (code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) throw new Error("This recovery session could not be restored. Request a new email from this page and open it directly in this browser.");
  } else if (access || refresh) {
    if (!access || !refresh || (type !== "invite" && type !== "recovery")) throw new Error("This setup link is invalid. Request a fresh setup email.");
    const { error } = await sb.auth.setSession({ access_token: access, refresh_token: refresh });
    if (error) throw new Error("This setup session has expired. Request a fresh setup email.");
  }
  const { data: { user }, error } = await sb.auth.getUser();
  if (error || !user) throw new Error(linkFailed ? "This email link was already used or has expired. Use the latest setup email, or sign in if you already set your password." : "Open your latest setup email in this browser, or sign in if you already set your password.");
  return { sb, user };
}
