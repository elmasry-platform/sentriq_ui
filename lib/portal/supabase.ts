import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// Public project settings only. No defaults: next.config.mjs stops the build
// when one is missing (see env-check.mjs). The anon key is designed to be exposed to
// browsers; the service-role key must never appear in this app.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? ""

let client: SupabaseClient | null = null

/** Lazily created so static prerendering never requires the env vars. */
export function getSupabase(): SupabaseClient {
  if (!client) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("supabase_not_configured")
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  }
  return client
}
