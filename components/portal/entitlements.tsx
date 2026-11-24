"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, XCircle } from "lucide-react"
import { rpc } from "@/lib/portal/api"
import { PortalEmpty, PortalLoading } from "./states"

interface EntitlementRow { entitlement_kind: string; entitlement_key: string; entitled: boolean }

export function EntitlementsPanel({ accessToken, tenantId }: { accessToken: string; tenantId: string }) {
  const [rows, setRows] = useState<EntitlementRow[] | null>(null)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    let active = true
    rpc<EntitlementRow[]>("list_my_entitlements", { p_tenant_id: tenantId }, accessToken)
      .then((r) => { if (active) setRows(r) })
      .catch(() => { if (active) setDenied(true) })
    return () => { active = false }
  }, [accessToken, tenantId])

  if (denied) return <PortalEmpty title="Entitlements not visible" hint="Only an active company superadmin can view the entitlement list." />
  if (!rows) return <PortalLoading label="Loading entitlements" />
  if (rows.length === 0) return <PortalEmpty title="No entitlements" hint="Module and feature entitlements will appear here." />

  return (
    <div className="panel platform-panel">
      <div className="panel-header">
        <div>
          <h2>Module & feature entitlements</h2>
          <p>What this company is entitled to use.</p>
        </div>
      </div>
      <table className="data-table">
        <thead>
          <tr><th>Kind</th><th>Entitlement</th><th>State</th></tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={`${e.entitlement_kind}:${e.entitlement_key}`}>
              <td><span className="ux-badge platform-capitalize">{e.entitlement_kind}</span></td>
              <td>{e.entitlement_key}</td>
              <td>
                {e.entitled
                  ? <span className="ux-badge ux-badge-approved"><CheckCircle2 size={13} /> Entitled</span>
                  : <span className="ux-badge ux-badge-returned"><XCircle size={13} /> Not entitled</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
