"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, XCircle } from "lucide-react"
import { authorize, getCapabilities, type CapabilitiesProfile } from "@/lib/portal/api"
import { PortalError, PortalLoading } from "./states"
import { LoadingState } from "@/components/sentriq/states"

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
    <div className="platform-metric-grid">
      <div className="metric-card platform-metric">
        <p className="platform-metric-label">Membership</p>
        <strong>{LEVEL_LABEL[caps.membership.level] ?? caps.membership.level}</strong>
        <span className="platform-muted platform-capitalize">{caps.membership.status}</span>
      </div>
      <div className="metric-card platform-metric">
        <p className="platform-metric-label">Site access</p>
        <strong>{caps.membership.siteIds.length === 0 ? "All sites" : `${caps.membership.siteIds.length} site(s)`}</strong>
        <span className="platform-muted">{caps.membership.displayName ?? ""}</span>
      </div>
      <div className="metric-card platform-metric">
        <p className="platform-metric-label">Entitlements</p>
        <strong>{caps.entitlements ? `${caps.entitlements.filter((e) => e.entitled).length} active` : "n/a"}</strong>
        <span className="platform-muted">module & feature access</span>
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

  if (error) return <PortalError message={error} onRetry={() => setResults(null)} />
  if (!results) return <LoadingState label="Checking permissions" />

  return (
    <div className="panel platform-panel">
      <div className="panel-header">
        <div>
          <h2>What you can do</h2>
          <p>Live answers from the backend for your account.</p>
        </div>
      </div>
      <table className="data-table">
        <tbody>
          {PROBE_PERMISSIONS.map((p) => {
            const allowed = results[`${p.key}:${p.action}`]
            return (
              <tr key={p.key + p.action}>
                <td>{p.label}</td>
                <td>
                  {allowed
                    ? <span className="ux-badge ux-badge-approved"><CheckCircle2 size={13} /> Allowed</span>
                    : <span className="ux-badge ux-badge-returned"><XCircle size={13} /> Not allowed</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
