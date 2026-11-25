"use client"

import Link from "next/link"
import { useEffect, useState, type FormEvent } from "react"
import { Languages, LoaderCircle } from "lucide-react"
import { parseInviteToken } from "@/lib/portal/invite-token"
import { registerInvited } from "@/lib/portal/accept-flow"
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
  const { session, loading, signOut } = usePortalSession()
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<InvitePreview | null | "invalid">(null)
  const [pw, setPw] = useState("")
  const [pw2, setPw2] = useState("")
  const [checkInbox, setCheckInbox] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const spinner = <LoaderCircle className="spin" role="status" aria-label={tt("accept.loading")} />

  useEffect(() => {
    const read = () => { setPreview(null); setError(null); setToken(parseInviteToken(window.location.hash)) }
    read()
    window.addEventListener("hashchange", read)
    return () => window.removeEventListener("hashchange", read)
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

  // A dead token has no further use: drop it from the address bar and history entry.
  useEffect(() => {
    if (preview === "invalid") window.history.replaceState(null, "", window.location.pathname)
  }, [preview])

  /** Accept with the signed-in token. A failure leaves the user signed in, so the button below retries it. */
  async function finishAccept(accessToken: string, tk: string) {
    await rpc("accept_my_invitation", { p_token: tk }, accessToken)
    window.history.replaceState(null, "", window.location.pathname)
    setDone(true)
    // Best effort: the token is spent, so drop it from the user's own metadata through the Auth API (as the user).
    getSupabase().auth.updateUser({ data: { invitation_token: null } }).catch(() => undefined)
  }

  /** Create the account with the invited email. The database gate rejects anything without a valid invitation. */
  async function register(event: FormEvent) {
    event.preventDefault()
    if (busy || !token || !preview || preview === "invalid") return
    setBusy(true); setError(null)
    const auth = getSupabase().auth
    const out = await registerInvited({
      signUp: async ({ email, password, token: tk }) => {
        const { data, error: err } = await auth.signUp({ email, password, options: { data: { invitation_token: tk } } })
        return { error: err, session: data.session ? { accessToken: data.session.access_token } : null, identities: data.user?.identities ?? null }
      },
      signIn: async ({ email, password }) => {
        const r = await auth.signInWithPassword({ email, password })
        return { error: r.error, accessToken: r.data.session?.access_token ?? null }
      },
      acceptInvitation: (accessToken, tk) => finishAccept(accessToken, tk),
    }, { email: preview.invited_email, password: pw, password2: pw2, token })
    if (out.kind === "error") setError(tt(out.key))
    else if (out.kind === "check_inbox") setCheckInbox(true)
    else if (out.kind === "accept_failed") setError(`${friendlyErrorLang(lang, out.error)} ${tt("accept.retryHint")}`)
    setBusy(false)
  }

  async function accept() {
    if (!session || !token) return
    setBusy(true); setError(null)
    try {
      await finishAccept(session.accessToken, token)
    } catch (e) {
      setError(friendlyErrorLang(lang, e))
    } finally { setBusy(false) }
  }

  return (
    <PortalLangProvider value={lang}>
      <div className={`platform-login${rtl ? " is-rtl" : ""}`} dir={rtl ? "rtl" : "ltr"}>
        <button type="button" className="language-button platform-login-lang" onClick={() => setLang(rtl ? "en" : "ar")} aria-label={rtl ? "Switch to English" : "التغيير إلى العربية"}><Languages size={16} aria-hidden="true" /><span>{tt("lang.toggle")}</span></button>
        <div className="platform-login-card">
          <div className="platform-login-brand"><h1>{tt("accept.title")}</h1><p>{tt("accept.hint")}</p></div>
          <div className="panel platform-login-form">
            {token === "" ? (<><p className="inspection-alert" role="alert">{tt("accept.missing")}</p><Link className="platform-muted" href="/portal/login">{tt("accept.backToSignIn")}</Link></>)
              : loading || token === null ? spinner
              : done ? (<><p>{tt("accept.done")}</p><Link className="button-primary platform-login-submit" href="/portal">{tt("accept.open")}</Link></>)
              : preview === null ? spinner
              : preview === "invalid" ? (<><p className="inspection-alert" role="alert">{tt("accept.invalid")}</p><Link className="platform-muted" href="/portal/login">{tt("accept.backToSignIn")}</Link></>)
              : !session ? (checkInbox ? <p role="status">{tt("accept.checkInbox")}</p> : (<>
                  <p>{tt("accept.invitedTo", { company: preview.company_name, level: tt(`level.${preview.management_level}` as Parameters<typeof t>[1]) })}</p>
                  <p className="platform-muted">{tt("accept.invitedEmail")}: <bdi dir="ltr">{preview.invited_email}</bdi></p>
                  <p className="platform-muted">{tt("accept.createHint")}</p>
                  <form className="platform-login-form-inner" onSubmit={register} noValidate>
                    <label htmlFor="pw">{tt("accept.password")}
                      <input id="pw" type={showPw ? "text" : "password"} autoComplete="new-password" minLength={10} required value={pw} onChange={e => setPw(e.target.value)} />
                    </label>
                    <label htmlFor="pw2">{tt("accept.password2")}
                      <input id="pw2" type={showPw ? "text" : "password"} autoComplete="new-password" minLength={10} required value={pw2} onChange={e => setPw2(e.target.value)} />
                    </label>
                    <label className="platform-check" htmlFor="showpw"><input id="showpw" type="checkbox" checked={showPw} onChange={e => setShowPw(e.target.checked)} />{tt("accept.showPasswords")}</label>
                    {error ? <p className="inspection-alert" role="alert">{error}</p> : null}
                    <button type="submit" className="button-primary platform-login-submit" disabled={busy}>{busy ? tt("accept.creating") : tt("accept.create")}</button>
                  </form>
                  <Link className="platform-muted" href="/portal/login">{tt("accept.haveAccount")}</Link>
                </>))
              : session.email.toLowerCase() !== preview.invited_email.toLowerCase()
              ? (<><p className="inspection-alert" role="alert">{tt("accept.wrongAccount", { email: session.email })}</p><button type="button" className="button-outline platform-login-submit" onClick={() => { void signOut() }}>{tt("accept.switchAccount")}</button></>)
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
