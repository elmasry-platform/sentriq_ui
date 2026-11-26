"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, XCircle } from "lucide-react"
import { authorize, getCapabilities, type CapabilitiesProfile } from "@/lib/portal/api"
import { useFriendlyError, useT, type CopyKey } from "@/lib/portal/i18n"
import { PortalError, PortalLoading } from "./states"
import { LoadingState } from "@/components/sentriq/states"

const LEVEL_KEY: Record<string, CopyKey> = {
  company_superadmin: "role.superadmin",
  company_admin: "role.admin",
  employee: "role.employee",
}

const PROBE_PERMISSIONS: { key: string; action: string; labelKey: CopyKey }[] = [
  { key: "hse.dashboard.read", action: "read", labelKey: "probe.hse.dashboard.read" },
  { key: "hse.inspections.read", action: "read", labelKey: "probe.hse.inspections.read" },
  { key: "hse.inspections.create", action: "write", labelKey: "probe.hse.inspections.create" },
  { key: "hse.inspections.review", action: "write", labelKey: "probe.hse.inspections.review" },
  { key: "hse.actions.read", action: "read", labelKey: "probe.hse.actions.read" },
  { key: "hse.actions.manage", action: "write", labelKey: "probe.hse.actions.manage" },
  { key: "hse.forms.read", action: "read", labelKey: "probe.hse.forms.read" },
  { key: "hse.forms.manage", action: "write", labelKey: "probe.hse.forms.manage" },
  { key: "hse.evidence.upload", action: "write", labelKey: "probe.hse.evidence.upload" },
  { key: "hse.reports.read", action: "read", labelKey: "probe.hse.reports.read" },
  { key: "core.structure.manage", action: "write", labelKey: "probe.core.structure.manage" },
]

export function CapabilitiesCard({ accessToken, tenantId }: { accessToken: string; tenantId: string }) {
  const t = useT()
  const fe = useFriendlyError()
  const [caps, setCaps] = useState<CapabilitiesProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let active = true
    setError(null)
    getCapabilities(accessToken, tenantId)
      .then((c) => { if (active) setCaps(c) })
      .catch((e) => { if (active) setError(fe(e)) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, tenantId, tick])

  if (error) return <PortalError message={error} onRetry={() => setTick((v) => v + 1)} />
  if (!caps) return <PortalLoading label={t("caps.loading")} />
  if (!caps.membership) return null

  return (
    <div className="platform-metric-grid">
      <div className="metric-card platform-metric">
        <p className="platform-metric-label">{t("caps.membership")}</p>
        <strong>{LEVEL_KEY[caps.membership.level] ? t(LEVEL_KEY[caps.membership.level]) : caps.membership.level}</strong>
        <span className="platform-muted platform-capitalize">{["active", "suspended", "invited", "ended"].includes(caps.membership.status) ? t(`status.${caps.membership.status}` as CopyKey) : caps.membership.status}</span>
      </div>
      <div className="metric-card platform-metric">
        <p className="platform-metric-label">{t("caps.sites")}</p>
        <strong>{caps.membership.siteIds.length === 0 ? t("caps.allSites") : t("caps.siteCount", { count: caps.membership.siteIds.length })}</strong>
      </div>
      <div className="metric-card platform-metric">
        <p className="platform-metric-label">{t("caps.entitlements")}</p>
        <strong>{caps.entitlements ? t("caps.activeCount", { count: caps.entitlements.filter((e) => e.entitled).length }) : t("caps.na")}</strong>
      </div>
    </div>
  )
}

export function PermissionMatrix({ accessToken, tenantId }: { accessToken: string; tenantId: string }) {
  const t = useT()
  const fe = useFriendlyError()
  const [results, setResults] = useState<Record<string, boolean> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all(PROBE_PERMISSIONS.map(async (p) => ({ id: `${p.key}:${p.action}`, allowed: await authorize(accessToken, tenantId, p.key, p.action).catch(() => false) })))
      .then((entries) => {
        if (!active) return
        setResults(Object.fromEntries(entries.map((e) => [e.id, e.allowed])))
      })
      .catch((e) => { if (active) setError(fe(e)) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, tenantId])

  if (error) return <PortalError message={error} onRetry={() => setResults(null)} />
  if (!results) return <LoadingState label={t("caps.checking")} />

  return (
    <details className="panel platform-panel platform-fold" open>
      <summary>{t("caps.matrix.title")}</summary>
      <table className="data-table matrix-table">
        <tbody>
          {PROBE_PERMISSIONS.map((p) => {
            const allowed = results[`${p.key}:${p.action}`]
            return (
              <tr key={p.key + p.action}>
                <td>{t(p.labelKey)}</td>
                <td>
                  {allowed
                    ? <span className="ux-badge ux-badge-approved"><CheckCircle2 size={13} /> {t("caps.allowed")}</span>
                    : <span className="ux-badge ux-badge-returned"><XCircle size={13} /> {t("caps.denied")}</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </details>
  )
}
