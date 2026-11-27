/** Pure decisions for operator two-step verification (Supabase TOTP). No network, no React. */
import type { PortalRole } from "./identity"

export type MfaStep = "ok" | "challenge" | "enroll"

/** Off unless NEXT_PUBLIC_OPERATOR_MFA is exactly "on". Mohamed decides when. */
export function mfaEnabled(flag: string | undefined): boolean {
  return flag === "on"
}

export function mfaRequired(role: PortalRole | undefined, flag: string | undefined): boolean {
  return mfaEnabled(flag) && (role === "owner" || role === "subowner")
}

/**
 * aal comes from supabase.auth.mfa.getAuthenticatorAssuranceLevel().
 * aal2 now: nothing to do. A verified factor exists (nextLevel aal2): ask for the code.
 * No verified factor: the person must enrol one first.
 */
export function mfaStep(aal: { currentLevel: string | null; nextLevel: string | null }, hasVerifiedTotp: boolean): MfaStep {
  if (aal.currentLevel === "aal2") return "ok"
  if (hasVerifiedTotp || aal.nextLevel === "aal2") return "challenge"
  return "enroll"
}

export function cleanCode(input: string): string {
  return input.replace(/\D/g, "").slice(0, 6)
}

export function isValidCode(input: string): boolean {
  return /^\d{6}$/.test(input)
}

/** Map a Supabase MFA error to a copy key. */
export function mfaErrorKey(error: { code?: string; message?: string } | null | undefined): "mfa.err.invalid" | "mfa.err.generic" {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase()
  return text.includes("mfa_verification_failed") || text.includes("invalid totp") || text.includes("invalid_code") ? "mfa.err.invalid" : "mfa.err.generic"
}
