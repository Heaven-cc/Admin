import { isSupabaseConfigured } from "@/lib/supabase/server";
import { SupabaseProvider } from "./supabase";
import { SupabaseMutations } from "./supabase-mutations";
import type { DataProvider, MutationBackend } from "./provider";

export function getDataProvider(): DataProvider {
  if (!isSupabaseConfigured()) throw new Error("Admin integration required.");
  return new SupabaseProvider();
}

export function getMutationBackend(): MutationBackend {
  if (!isSupabaseConfigured()) throw new Error("Admin integration required.");
  return new SupabaseMutations();
}
