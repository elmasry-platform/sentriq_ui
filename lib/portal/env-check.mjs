// Public settings the portal needs at build time. There are no defaults on
// purpose: a build with a missing value must fail instead of silently pointing
// at the TEST database or the staging backend.
export const REQUIRED_PUBLIC_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_BACKEND_URL",
]

export function missingPublicEnv(env) {
  return REQUIRED_PUBLIC_ENV.filter((name) => !String(env[name] ?? "").trim())
}

export function assertPublicEnv(env) {
  const missing = missingPublicEnv(env)
  if (missing.length > 0) {
    throw new Error(`Build stopped: missing required environment variables: ${missing.join(", ")}`)
  }
}
