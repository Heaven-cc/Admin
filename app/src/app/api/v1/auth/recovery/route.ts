import { NextResponse } from "next/server";
import { runtimeConfig } from "@/lib/config";

/** Public Auth recovery, with a fixed callback and no browser-specific verifier. */
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const input = await request.json().catch(() => null);
  if (typeof input?.email !== "string" || input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return NextResponse.json({ error: "Enter a valid administrator email." }, { status: 400, headers });
  }
  const config = runtimeConfig();
  if (config.mode !== "supabase") return NextResponse.json({ error: "Administrator recovery is unavailable." }, { status: 503, headers });
  try {
    // Use only the project's public key. Auth retains its normal rate limits and email checks.
    // Without a PKCE challenge, Auth returns email tokens for the existing emailSession handoff.
    const url = new URL("/auth/v1/recover", config.url);
    url.searchParams.set("redirect_to", "http://localhost:3000/reset?step=change");
    const result = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: config.key! },
      body: JSON.stringify({ email: input.email.trim().toLowerCase() }),
      cache: "no-store", signal: AbortSignal.timeout(20_000),
    });
    if (result.status === 429) return NextResponse.json({ error: "Email sending is temporarily rate-limited. Please wait before requesting another setup email." }, { status: 429, headers });
    if (!result.ok) return NextResponse.json({ error: "The recovery email could not be requested. Please try again later." }, { status: 502, headers });
    return NextResponse.json({ message: "If this address has an account, a recovery email has been sent. Open its button directly in this browser." }, { status: 202, headers });
  } catch {
    return NextResponse.json({ error: "The recovery service is unavailable. Please try again later." }, { status: 503, headers });
  }
}
