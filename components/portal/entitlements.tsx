"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, XCircle } from "lucide-react"
import { rpc } from "@/lib/portal/api"
import { useT } from "@/lib/portal/i18n"
import { PortalEmpty, PortalLoading } from "./states"

interface EntitlementRow { entitlement_kind: string; entitlement_key: string; entitled: boolean }

export function EntitlementsPanel({ accessToken, tenantId }: { accessToken: string; tenantId: string }) {
  const t = useT()
  const [rows, setRows] = useState<EntitlementRow[] | null>(null)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    let active = true
    rpc<EntitlementRow[]>("list_my_entitlements", { p_tenant_id: tenantId }, accessToken)
      .then((r) => { if (active) setRows(r) })
      .catch(() => { if (active) setDenied(true) })
    return () => { active = false }
  }, [accessToken, tenantId])

  if (denied) return <PortalEmpty titleKey="ent.denied.title" hintKey="ent.denied.hint" />
  if (!rows) return <PortalLoading label={t("ent.loading")} />
  if (rows.length === 0) return <PortalEmpty titleKey="ent.empty.title" hintKey="ent.empty.hint" />

  return (
    <div className="panel platform-panel">
      <div className="panel-header">
        <div>
          <h2>{t("ent.panel.title")}</h2>
          <p>{t("ent.panel.subtitle")}</p>
        </div>
      </div>
      <table className="data-table">
        <thead>
          <tr><th>{t("ent.kind")}</th><th>{t("ent.entitlement")}</th><th>{t("ent.state")}</th></tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={`${e.entitlement_kind}:${e.entitlement_key}`}>
              <td><span className="ux-badge platform-capitalize">{e.entitlement_kind}</span></td>
              <td>{e.entitlement_key}</td>
              <td>
                {e.entitled
                  ? <span className="ux-badge ux-badge-approved"><CheckCircle2 size={13} /> {t("ent.entitled")}</span>
                  : <span className="ux-badge ux-badge-returned"><XCircle size={13} /> {t("ent.notEntitled")}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
