"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState, type ReactNode } from "react"
import { ShieldCheck, LogOut } from "lucide-react"
import { usePortalSession } from "@/lib/portal/session"
import { resolveIdentity, type PortalIdentity, type PortalRole } from "@/lib/portal/identity"
import { PortalDenied, PortalError, PortalLoading } from "./states"

const ROLE_LABEL: Record<PortalRole, string> = {
  owner: "Platform Owner",
  subowner: "Sub-owner",
  superadmin: "Company Superadmin",
  admin: "Company Admin",
  employee: "Employee",
}

export function roleLabel(role: PortalRole) { return ROLE_LABEL[role] }

export function PortalShell({
  expect,
  title,
  subtitle,
  children,
}: {
  expect: PortalRole
  title: string
  subtitle?: string
  children: (ctx: { session: { accessToken: string; userId: string; email: string }; identity: PortalIdentity; reload: () => void }) => ReactNode
}) {
  const router = useRouter()
  const { session, loading, signOut } = usePortalSession()
  const [identity, setIdentity] = useState<PortalIdentity | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (loading) return
    if (!session) {
      router.replace("/portal/login")
      return
    }
    let active = true
    setResolving(true)
    setError(null)
    resolveIdentity(session.accessToken, session.userId)
      .then((id) => { if (active) setIdentity(id) })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "identity_resolution_failed") })
      .finally(() => { if (active) setResolving(false) })
    return () => { active = false }
  }, [session, loading, router, tick])

  const handleSignOut = useCallback(async () => {
    await signOut()
    router.replace("/portal/login")
  }, [signOut, router])

  if (loading || !session) return <PortalLoading label="Checking your session" />
  if (resolving || !identity) {
    return error ? <PortalError message={error} onRetry={reload} /> : <PortalLoading label="Resolving your access" />
  }
  if (error) return <PortalError message={error} onRetry={reload} />
  if (identity.role !== expect) {
    return <PortalDenied role={ROLE_LABEL[expect]} onSignOut={handleSignOut} />
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-slate-900">SENTRIQ</p>
              <p className="text-[11px] font-medium text-slate-500">{ROLE_LABEL[identity.role]} portal</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-slate-500 sm:block">{session.email}</span>
            <button onClick={handleSignOut} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {children({ session, identity, reload })}
      </main>
    </div>
  )
}
