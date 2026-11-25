import type { CopyKey } from "./i18n"

export interface AuthError { message?: string; status?: number; code?: string; name?: string }

/** Map a signup failure to one distinct copy key. A rejected sign-up gate is the invalid-link message. */
export function signupMessageKey(err: AuthError): CopyKey {
  const code = err.code ?? ""
  const msg = err.message ?? ""
  if (code === "weak_password" || (/password/i.test(msg) && /(weak|short|least|characters)/i.test(msg))) return "accept.pwWeak"
  if (err.status === 429 || /rate.?limit/i.test(code) || /rate limit/i.test(msg)) return "accept.rate"
  if (code === "user_already_exists" || /already (been )?registered|already exists/i.test(msg)) return "accept.exists"
  if (err.status === 403 || /signup_requires_valid_invitation/.test(msg)) return "accept.invalid"
  if (err.status === 0 || err.status === undefined || /fetch|network|retryable/i.test(`${err.name} ${msg}`)) return "accept.network"
  return "accept.generic"
}

export interface AcceptDeps {
  signUp(args: { email: string; password: string; token: string }): Promise<{ error: AuthError | null; session: { accessToken: string } | null; identities: unknown[] | null }>
  signIn(args: { email: string; password: string }): Promise<{ error: AuthError | null; accessToken: string | null }>
  acceptInvitation(accessToken: string, token: string): Promise<void>
}

export type RegisterOutcome =
  | { kind: "done" }
  | { kind: "check_inbox" }
  | { kind: "error"; key: CopyKey }
  /** The account exists and is signed in, but accepting failed. The button retries it. */
  | { kind: "accept_failed"; error: unknown }

export async function registerInvited(deps: AcceptDeps, a: { email: string; password: string; password2: string; token: string }): Promise<RegisterOutcome> {
  if (a.password.length < 10) return { kind: "error", key: "accept.pwShort" }
  if (a.password !== a.password2) return { kind: "error", key: "accept.pwMismatch" }
  try {
    const up = await deps.signUp({ email: a.email, password: a.password, token: a.token })
    if (up.error) return { kind: "error", key: signupMessageKey(up.error) }
    // An address that already has an account comes back without identities and without a session.
    if (Array.isArray(up.identities) && up.identities.length === 0) return { kind: "error", key: "accept.exists" }
    let accessToken = up.session?.accessToken ?? null
    if (!accessToken) {
      // No session: either mailbox confirmation is on, or the sign-up did not take. Ask the server, do not guess.
      const si = await deps.signIn({ email: a.email, password: a.password })
      if (si.error) return si.error.code === "email_not_confirmed" ? { kind: "check_inbox" } : { kind: "error", key: signupMessageKey(si.error) }
      accessToken = si.accessToken
    }
    if (!accessToken) return { kind: "error", key: "accept.generic" }
    try { await deps.acceptInvitation(accessToken, a.token) } catch (error) { return { kind: "accept_failed", error } }
    return { kind: "done" }
  } catch (e) {
    return { kind: "error", key: signupMessageKey(e as AuthError) }
  }
}
