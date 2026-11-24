"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"
import { LoaderCircle } from "lucide-react"
import { usePortalSession } from "@/lib/portal/session"

export default function PortalLoginPage() {
  const { signIn } = usePortalSession()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
      // Full navigation so the new session is read from storage deterministically
      // (router.replace can race supabase session persistence in the static export).
      window.location.assign("/portal")
    } catch {
      setError("Invalid email or password.")
      setBusy(false)
    }
  }

  return (
    <div className="platform-login">
      <div className="platform-login-card">
        <div className="platform-login-brand">
          <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M23.5 6.5H13.2a6.7 6.7 0 0 0 0 13.4h5.6a6.7 6.7 0 0 1 0 13.4H8.5" transform="translate(0 -3.9)" stroke="currentColor" strokeWidth="2.1" strokeLinecap="square" /><circle cx="24" cy="4.8" r="2.1" fill="#D46A43" /></svg></span>
          <h1>Sign in to SENTRIQ</h1>
          <p>Use your platform or company account.</p>
        </div>
        <form onSubmit={onSubmit} className="panel platform-login-form">
          <label htmlFor="email">Email
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label htmlFor="password">Password
            <input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error ? <p className="inspection-alert" role="alert">{error}</p> : null}
          <button type="submit" disabled={busy} className="button-primary platform-login-submit">
            {busy ? <LoaderCircle size={15} className="spin" /> : null}
            Sign in
          </button>
        </form>
        <p className="platform-login-back"><Link href="/">Back to sentriq.online</Link></p>
      </div>
    </div>
  )
}
