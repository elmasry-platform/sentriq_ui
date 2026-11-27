"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { LoaderCircle, LogOut } from "lucide-react"
import { getSupabase } from "@/lib/portal/supabase"
import { t, type CopyKey, type PortalLang } from "@/lib/portal/i18n"
import { cleanCode, isValidCode, mfaErrorKey, mfaStep } from "@/lib/portal/mfa"
import { LoadingState } from "@/components/sentriq/states"

type Phase = "checking" | "enroll" | "challenge" | "failed"
interface Enrol { factorId: string; qr: string; secret: string }

/**
 * Second step for platform operators. Renders nothing until the shell asks for it
 * (only when mfaRequired). Calls onPassed once the session is aal2.
 */
export function MfaGate({ lang, onPassed, onSignOut }: { lang: PortalLang; onPassed: () => void; onSignOut: () => void }) {
  const tt = (key: CopyKey, vars?: Record<string, string | number>) => t(lang, key, vars)
  const rtl = lang === "ar"
  const [phase, setPhase] = useState<Phase>("checking")
  const [factorId, setFactorId] = useState<string | null>(null)
  const [enrol, setEnrol] = useState<Enrol | null>(null)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<CopyKey | null>(null)
  const started = useRef(false)

  const start = useCallback(async () => {
    setError(null)
    const auth = getSupabase().auth
    const { data: aal, error: aalError } = await auth.mfa.getAuthenticatorAssuranceLevel()
    if (aalError || !aal) { setError("mfa.err.generic"); setPhase("failed"); return }
    const { data: factors } = await auth.mfa.listFactors()
    const verified = factors?.totp?.find((f) => f.status === "verified")
    const step = mfaStep(aal, !!verified)
    if (step === "ok") { onPassed(); return }
    if (step === "challenge") { setFactorId(verified?.id ?? null); setPhase(verified ? "challenge" : "failed"); if (!verified) setError("mfa.err.generic"); return }
    // Enrol. A half-finished earlier attempt would block a new one: remove it first.
    for (const f of (factors?.all ?? []).filter((x) => x.factor_type === "totp" && x.status === "unverified")) await auth.mfa.unenroll({ factorId: f.id })
    const { data, error: enrolError } = await auth.mfa.enroll({ factorType: "totp", friendlyName: `SENTRIQ ${new Date().toISOString().slice(0, 16)}` })
    if (enrolError || !data) { setError("mfa.err.generic"); setPhase("failed"); return }
    setEnrol({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
    setFactorId(data.id)
    setPhase("enroll")
  }, [onPassed])

  useEffect(() => {
    if (started.current) return
    started.current = true
    start().catch(() => { setError("mfa.err.generic"); setPhase("failed") })
  }, [start])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!factorId || !isValidCode(code) || busy) return
    setBusy(true); setError(null)
    const { error: verifyError } = await getSupabase().auth.mfa.challengeAndVerify({ factorId, code })
    setBusy(false)
    if (verifyError) { setError(mfaErrorKey(verifyError)); setCode(""); return }
    onPassed()
  }

  if (phase === "checking") return <div className="platform-boot"><LoadingState label={tt("mfa.boot")} /></div>

  return (
    <div className={`platform-login${rtl ? " is-rtl" : ""}`} dir={rtl ? "rtl" : "ltr"} data-testid="mfa-gate">
      <div className="platform-login-card">
        <div className="platform-login-brand">
          <h1>{tt("mfa.title")}</h1>
          {phase === "enroll" ? <p>{tt("mfa.enroll.intro")}</p> : phase === "challenge" ? <p>{tt("mfa.challenge.intro")}</p> : null}
        </div>
        {phase === "failed" ? (
          <div className="panel platform-login-form">
            {error ? <p className="inspection-alert" role="alert">{tt(error)}</p> : null}
            <button type="button" className="button-primary platform-login-submit" onClick={() => { started.current = false; setPhase("checking"); start().catch(() => { setError("mfa.err.generic"); setPhase("failed") }) }}>{tt("shell.retry")}</button>
          </div>
        ) : (
          <form onSubmit={submit} className="panel platform-login-form">
            {phase === "enroll" && enrol ? (
              <>
                {/* The QR is an SVG data URI from Supabase; the CSP allows data: images. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={enrol.qr} alt={tt("mfa.qr.alt")} width={180} height={180} style={{ alignSelf: "center", background: "#fff", padding: 8, borderRadius: 8 }} />
                <p className="platform-muted">{tt("mfa.enroll.secret")} <code dir="ltr" style={{ overflowWrap: "anywhere" }} data-testid="mfa-secret">{enrol.secret}</code></p>
              </>
            ) : null}
            <label htmlFor="mfa-code">{tt("mfa.code")}
              <input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} dir="ltr" required autoFocus
                value={code} onChange={(e) => setCode(cleanCode(e.target.value))} />
            </label>
            {error ? <p className="inspection-alert" role="alert">{tt(error)}</p> : null}
            <button type="submit" disabled={busy || !isValidCode(code)} className="button-primary platform-login-submit">
              {busy ? <LoaderCircle size={15} className="spin" /> : null}
              {busy ? tt("mfa.working") : tt("mfa.verify")}
            </button>
          </form>
        )}
        <p className="platform-muted" style={{ textAlign: "center" }}>{tt("mfa.lost")}</p>
        <p className="platform-login-back"><button type="button" className="button-outline" onClick={onSignOut}><LogOut size={14} aria-hidden="true" /> {tt("shell.signout")}</button></p>
      </div>
    </div>
  )
}
