import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { runtimeConfig } from "./lib/config";
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname, api = path.startsWith("/api/");
  if (api && !["GET", "HEAD", "OPTIONS"].includes(request.method) && (request.headers.get("origin") !== request.nextUrl.origin || request.headers.get("X-Admin-Request") !== "1")) return NextResponse.json({ error: { code: "CSRF", message: "Same-origin administrator request required." } }, { status: 403 });
  let config;
  try { config = runtimeConfig(); } catch { return api ? NextResponse.json({ error: { code: "CONFIGURATION", message: "Admin configuration unavailable." } }, { status: 503 }) : path === "/setup" ? NextResponse.next() : NextResponse.redirect(new URL("/setup", request.url)); }
  if (config.mode === "unconfigured") return api ? (path === "/api/v1/health" ? NextResponse.next() : NextResponse.json({ error: { code: "UNAVAILABLE", message: "Configure the separate Admin backend." } }, { status: 503 })) : path === "/setup" ? NextResponse.next() : NextResponse.redirect(new URL("/setup", request.url));
  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url!, config.key!, { cookies: {
    getAll: () => request.cookies.getAll(),
    setAll: (values: Parameters<SetAllCookies>[0]) => { values.forEach(({ name, value }) => request.cookies.set(name, value)); response = NextResponse.next({ request }); values.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); },
  } });
  const { data: { user } } = await supabase.auth.getUser();
  const publicPath = ["/login", "/mfa", "/invite", "/auth", "/reset", "/setup", "/403"].some(p => path === p || path.startsWith(p + "/"));
  if (!api && !publicPath) {
    const assurance = user ? await supabase.auth.mfa.getAuthenticatorAssuranceLevel() : null;
    if (!user || assurance?.data?.currentLevel !== "aal2") {
      const destination = new URL(user ? "/mfa" : "/login", request.url); destination.searchParams.set("next", path);
      const redirect = NextResponse.redirect(destination); response.cookies.getAll().forEach(c => redirect.cookies.set(c)); return redirect;
    }
  }
  response.headers.set("Cache-Control", "private, no-store"); return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|ico|webp)$).*)"] };
