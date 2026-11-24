"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { usePortalSession } from "@/lib/portal/session"
import { rpc } from "@/lib/portal/api"
import { PortalLangProvider, friendlyErrorLang, t, useStoredPortalLang } from "@/lib/portal/i18n"

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

  useEffect(() => {
    const m = /token=([0-9a-f]{32,256})/i.exec(window.location.hash)
    setToken(m ? m[1] : "")
  }, [])

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
              : !session ? <Link className="button-primary platform-login-submit" href="/portal/login">{tt("accept.signin")}</Link>
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
