import { runtimeConfig } from "@/lib/config";
import { cookies } from "next/headers";
import { createServerClient, type SetAllCookies } from "@supabase/ssr";

/** RLS-scoped server client (user cookie session) — never the service role. */
export async function createClient() {
  const store = await cookies();
  const config = runtimeConfig();
  if (config.mode !== "supabase") throw new Error("Admin backend unavailable.");
  return createServerClient(
    config.url!,
    config.key!,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              store.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — middleware refreshes sessions.
          }
        },
      },
    }
  );
}

export function isSupabaseConfigured(): boolean {
  return runtimeConfig().mode === "supabase";
}
