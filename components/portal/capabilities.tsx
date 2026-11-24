"use client"

import { useEffect, useState } from "react"
import { KeyRound, CheckCircle2, XCircle, LoaderCircle } from "lucide-react"
import { authorize, getCapabilities, type CapabilitiesProfile } from "@/lib/portal/api"
import { PortalError, PortalLoading } from "./states"

const LEVEL_LABEL: Record<string, string> = {
  company_superadmin: "Company Superadmin",
  company_admin: "Company Admin",
  employee: "Employee",
}

const PROBE_PERMISSIONS: { key: string; action: string; label: string }[] = [
  { key: "hse.dashboard.read", action: "read", label: "View HSE dashboard" },
  { key: "hse.inspections.read", action: "read", label: "View inspections" },
  { key: "hse.inspections.create", action: "write", label: "Create & update inspections" },
  { key: "hse.inspections.review", action: "write", label: "Review inspections" },
  { key: "hse.actions.read", action: "read", label: "View corrective actions" },
  { key: "hse.actions.manage", action: "write", label: "Manage corrective actions" },
  { key: "hse.forms.read", action: "read", label: "View forms" },
  { key: "hse.forms.manage", action: "write", label: "Manage forms" },
  { key: "hse.evidence.upload", action: "write", label: "Upload evidence" },
  { key: "core.structure.manage", action: "write", label: "Manage sites & org units" },
]

export function CapabilitiesCard({ accessToken, tenantId }: { accessToken: string; tenantId: string }) {
  const [caps, setCaps] = useState<CapabilitiesProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let active = true
    setError(null)
    getCapabilities(accessToken, tenantId)
      .then((c) => { if (active) setCaps(c) })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "capabilities_load_failed") })
    return () => { active = false }
  }, [accessToken, tenantId, tick])

  if (error) return <PortalError message={error} onRetry={() => setTick((t) => t + 1)} />
  if (!caps) return <PortalLoading label="Loading your capabilities" />
  if (!caps.membership) return null

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Membership</p>
        <p className="mt-1.5 text-sm font-semibold text-slate-900">{LEVEL_LABEL[caps.membership.level] ?? caps.membership.level}</p>
        <p className="mt-0.5 text-xs capitalize text-slate-500">{caps.membership.status}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Site access</p>
        <p className="mt-1.5 text-sm font-semibold text-slate-900">{caps.membership.siteIds.length === 0 ? "All sites" : `${caps.membership.siteIds.length} site(s)`}</p>
        <p className="mt-0.5 text-xs text-slate-500">{caps.membership.displayName ?? ""}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Entitlements</p>
        <p className="mt-1.5 text-sm font-semibold text-slate-900">
          {caps.entitlements ? `${caps.entitlements.filter((e) => e.entitled).length} active` : "n/a"}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">module & feature access</p>
      </div>
    </div>
  )
}

export function PermissionMatrix({ accessToken, tenantId }: { accessToken: string; tenantId: string }) {
  const [results, setResults] = useState<Record<string, boolean> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all(PROBE_PERMISSIONS.map(async (p) => ({ id: `${p.key}:${p.action}`, allowed: await authorize(accessToken, tenantId, p.key, p.action).catch(() => false) })))
      .then((entries) => {
        if (!active) return
        setResults(Object.fromEntries(entries.map((e) => [e.id, e.allowed])))
      })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "authorize_failed") })
    return () => { active = false }
  }, [accessToken, tenantId])

  if (error) return <p className="text-sm text-rose-600">{error}</p>
  if (!results) return (
    <div className="flex items-center gap-2 py-4 text-sm text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin" /> Checking permissions...</div>
  )

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
        <KeyRound className="h-4 w-4 text-slate-400" />
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">What you can do (live from backend)</p>
      </div>
      <ul className="divide-y divide-slate-50">
        {PROBE_PERMISSIONS.map((p) => {
          const allowed = results[`${p.key}:${p.action}`]
          return (
            <li key={p.key + p.action} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-slate-700">{p.label}</span>
              {allowed
                ? <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Allowed</span>
                : <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400"><XCircle className="h-4 w-4" /> Not allowed</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
