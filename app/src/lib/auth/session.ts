import { createClient } from "@/lib/supabase/server";
import { runtimeConfig } from "@/lib/config";
import { ROLES, type Permission, type RoleKey } from "./permissions";
export interface Session {
  userId: string; email: string; name: string; role: RoleKey;
  permissions: string[]; mfa: boolean; issuedAt: number; expiresAt: number;
}
export async function getSession(): Promise<Session | null> {
  const config = runtimeConfig();
  if (config.mode === "unconfigured") return null;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || assurance.data.currentLevel !== "aal2") return null;
  const { data, error: profileError } = await supabase.rpc("admin_session");
  if (profileError || !data || !ROLES.includes(data.role) || typeof data.email !== "string" || typeof data.name !== "string" || !Array.isArray(data.permissions) || !data.permissions.every((p: unknown)=>typeof p === "string") || !Number.isFinite(Date.parse(data.expires_at)) || !Number.isFinite(Date.parse(data.started_at)) || Date.parse(data.expires_at) <= Date.now()) return null;
  return { userId: user.id, email: data.email, name: data.name, role: data.role, permissions: data.permissions, mfa: true, issuedAt: new Date(data.started_at).getTime(), expiresAt: new Date(data.expires_at).getTime() };
}
export function can(session: Session | null, permission: Permission): boolean { return !!session?.mfa && session.permissions.includes(permission); }
export async function requireApiSession(permission?: Permission): Promise<{ session: Session } | { error: "unauthenticated" } | { error: "forbidden"; permission: Permission }> {
  const session = await getSession();
  if (!session?.mfa) return { error: "unauthenticated" };
  if (permission && !can(session, permission)) return { error: "forbidden", permission };
  return { session };
}
