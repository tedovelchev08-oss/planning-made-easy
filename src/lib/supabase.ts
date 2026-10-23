import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./db-types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * True when both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are present.
 * When false the app boots in demo mode — seeded, in-memory, no network —
 * so a fresh checkout still runs end to end.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

/*
 * The client deliberately uses default (loose) generics: supabase-js minor
 * versions churn the GenericSchema constraints, and db-types.ts stays the
 * single typed contract through the mappers in api.ts. Regenerate strict
 * types with `supabase gen types typescript --local > src/lib/db-types.ts`
 * and re-thread <Database> here when you want full builder-level inference.
 */
export type AppDatabase = Database;

/**
 * Read before the client below consumes the URL. A password-reset email links
 * back here with "type=recovery" in the hash and signs the person in; without
 * noticing it they landed on the homepage, signed in, with no way to choose
 * the new password. An expired or reused link comes back with an error instead.
 */
const arrivedHash = typeof window === "undefined" ? "" : window.location.hash;
export const arrivedFromResetLink = /(^#|&)type=recovery(&|$)/.test(arrivedHash);
export const arrivedWithLinkError = /(^#|&)error_code=/.test(arrivedHash);

export const sb: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

/** throws with a readable message when a cloud path runs without config */
export function requireSb(): SupabaseClient {
  if (!sb) throw new Error("Supabase is not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
  return sb;
}
