"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { usePortalSession } from "@/lib/portal/session"
import { rpc } from "@/lib/portal/api"
import { SUPABASE_ANON_KEY, getSupabase } from "@/lib/portal/supabase"
import { PortalLangProvider, friendlyErrorLang, t, useStoredPortalLang } from "@/lib/portal/i18n"

interface InvitePreview { company_name: string; management_level: string; invited_email: string; invitee_name: string | null; expires_at: string }

/** The invitation token travels in the URL fragment so it is never sent to a server or logged. */
export default function AcceptInvitationPage() {
  const [lang, setLang] = useStoredPortalLang()
  const rtl = lang === "ar"
  const tt = (key: Parameters<typeof t>[1], vars?: Record<string, string | number>) => t(lang, key, vars)
  const { session, loading } = usePortalSession()
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<InvitePreview | null | "invalid">(null)
  const [pw, setPw] = useState("")
  const [pw2, setPw2] = useState("")
  const [checkInbox, setCheckInbox] = useState(false)

  useEffect(() => {
    const m = /token=([0-9a-f]{32,256})/i.exec(window.location.hash)
    setToken(m ? m[1] : "")
  }, [])

  // Anonymous preview: shows company, level and the invited email. One uniform failure for any bad link.
  useEffect(() => {
    if (!token) return
    let active = true
    rpc<InvitePreview[]>("preview_invitation", { p_token: token }, SUPABASE_ANON_KEY)
      .then(rows => { if (active) setPreview(Array.isArray(rows) && rows[0] ? rows[0] : "invalid") })
      .catch(() => { if (active) setPreview("invalid") })
    return () => { active = false }
  }, [token])

  /** Map a signup failure to one distinct message. The hook's own rejection is the invalid-link message. */
  function signupMessage(err: { message?: string; status?: number; code?: string; name?: string }): string {
    const code = err.code ?? ""
    const msg = err.message ?? ""
    if (code === "weak_password" || /password/i.test(msg) && /(weak|short|least|characters)/i.test(msg)) return tt("accept.pwWeak")
    if (err.status === 429 || /rate.?limit/i.test(code) || /rate limit/i.test(msg)) return tt("accept.rate")
    if (code === "user_already_exists" || /already (been )?registered|already exists/i.test(msg)) return tt("accept.exists")
    if (err.status === 403 || /signup_requires_valid_invitation/.test(msg)) return tt("accept.invalid")
    if (err.status === 0 || err.status === undefined || /fetch|network|retryable/i.test(`${err.name} ${msg}`)) return tt("accept.network")
    return tt("accept.generic")
  }

  /** Accept with the signed-in token. A failure leaves the user signed in, so the button below retries it. */
  async function finishAccept(accessToken: string) {
    await rpc("accept_my_invitation", { p_token: token }, accessToken)
    window.history.replaceState(null, "", window.location.pathname)
    setDone(true)
    // Best effort: the token is spent, so drop it from the user's own metadata through the Auth API (as the user).
    getSupabase().auth.updateUser({ data: { invitation_token: null } }).catch(() => undefined)
  }

  /** Create the account with the invited email. The database gate rejects anything without a valid invitation. */
  async function register() {
    if (!token || !preview || preview === "invalid") return
    if (pw.length < 10) { setError(tt("accept.pwShort")); return }
    if (pw !== pw2) { setError(tt("accept.pwMismatch")); return }
    setBusy(true); setError(null)
    try {
      const { data, error: err } = await getSupabase().auth.signUp({
        email: preview.invited_email, password: pw, options: { data: { invitation_token: token } },
      })
      if (err) { setError(signupMessage(err)); return }
      // An address that already has an account comes back without identities and without a session.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) { setError(tt("accept.exists")); return }
      let accessToken = data.session?.access_token ?? null
      if (!accessToken) {
        // No session: either mailbox confirmation is on, or the sign-up did not take. Ask the server, do not guess.
        const signed = await getSupabase().auth.signInWithPassword({ email: preview.invited_email, password: pw })
        if (signed.error) {
          if (signed.error.code === "email_not_confirmed") setCheckInbox(true)
          else setError(signupMessage(signed.error))
          return
        }
        accessToken = signed.data.session?.access_token ?? null
      }
      if (!accessToken) { setError(tt("accept.generic")); return }
      try { await finishAccept(accessToken) }
      catch (e) { setError(`${friendlyErrorLang(lang, e)} ${tt("accept.retryHint")}`) }
    } catch (e) {
      setError(signupMessage(e as { message?: string; name?: string }))
    } finally { setBusy(false) }
  }

  async function accept() {
    if (!session || !token) return
    setBusy(true); setError(null)
    try {
      await finishAccept(session.accessToken)
    } catch (e) {
      setError(friendlyErrorLang(lang, e))
    } finally { setBusy(false) }
  }

  return (
    <PortalLangProvider value={lang}>
      <div className={`platform-login${rtl ? " is-rtl" : ""}`} dir={rtl ? "rtl" : "ltr"}>
        <button type="button" className="language-button platform-login-lang" onClick={() => setLang(rtl ? "en" : "ar")}><span>{tt("lang.toggle")}</span></button>
        <div className="platform-login-card">
          <div className="platform-login-brand"><h1>{tt("accept.title")}</h1><p>{tt("accept.hint")}</p></div>
          <div className="panel platform-login-form">
            {token === "" ? <p className="inspection-alert" role="alert">{tt("accept.missing")}</p>
              : loading || token === null ? <LoaderCircle className="spin" />
              : done ? (<><p>{tt("accept.done")}</p><Link className="button-primary platform-login-submit" href="/portal">{tt("accept.open")}</Link></>)
              : preview === null ? <LoaderCircle className="spin" />
              : preview === "invalid" ? <p className="inspection-alert" role="alert">{tt("accept.invalid")}</p>
              : !session ? (checkInbox ? <p role="status">{tt("accept.checkInbox")}</p> : (<>
                  <p>{tt("accept.invitedTo", { company: preview.company_name, level: tt(`level.${preview.management_level}` as Parameters<typeof t>[1]) })}</p>
                  <p className="platform-muted">{tt("accept.invitedEmail")}: <bdi dir="ltr">{preview.invited_email}</bdi></p>
                  <p className="platform-muted">{tt("accept.createHint")}</p>
                  <label htmlFor="pw">{tt("accept.password")}
                    <input id="pw" type="password" autoComplete="new-password" minLength={10} value={pw} onChange={e => setPw(e.target.value)} />
                  </label>
                  <label htmlFor="pw2">{tt("accept.password2")}
                    <input id="pw2" type="password" autoComplete="new-password" minLength={10} value={pw2} onChange={e => setPw2(e.target.value)} />
                  </label>
                  {error ? <p className="inspection-alert" role="alert">{error}</p> : null}
                  <button type="button" className="button-primary platform-login-submit" disabled={busy} onClick={register}>{busy ? tt("accept.creating") : tt("accept.create")}</button>
                  <Link className="platform-muted" href="/portal/login">{tt("accept.haveAccount")}</Link>
                </>))
              : session.email.toLowerCase() !== preview.invited_email.toLowerCase()
              ? <p className="inspection-alert" role="alert">{tt("accept.wrongAccount", { email: session.email })}</p>
              : (<>
                  <p className="platform-muted">{tt("accept.as", { email: session.email })}</p>
                  {error ? <p className="inspection-alert" role="alert">{error}</p> : null}
                  <button type="button" className="button-primary platform-login-submit" disabled={busy} onClick={accept}>{busy ? tt("accept.working") : tt("accept.submit")}</button>
                </>)}
          </div>
        </div>
      </div>
    </PortalLangProvider>
  )
}
