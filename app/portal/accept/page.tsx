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
      if (err) {
        setError(/already/i.test(err.message) ? tt("accept.exists") : tt("err.inv.invalid"))
        return
      }
      if (!data.session) { setCheckInbox(true); return }   // mailbox confirmation is on: finish after the link in the email
      await rpc("accept_my_invitation", { p_token: token }, data.session.access_token)
      window.history.replaceState(null, "", window.location.pathname)
      setDone(true)
    } catch (e) {
      setError(friendlyErrorLang(lang, e))
    } finally { setBusy(false) }
  }

  async function accept() {
    if (!session || !token) return
    setBusy(true); setError(null)
    try {
      await rpc("accept_my_invitation", { p_token: token }, session.accessToken)
      window.history.replaceState(null, "", window.location.pathname)
      setDone(true)
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
