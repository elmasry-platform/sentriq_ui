"use client"

import { useEffect, useState } from "react"
import { PackageCheck, CheckCircle2, XCircle } from "lucide-react"
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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
        <PackageCheck className="h-4 w-4 text-slate-400" />
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Module & feature entitlements</p>
      </div>
      <ul className="divide-y divide-slate-50">
        {rows.map((e) => (
          <li key={`${e.entitlement_kind}:${e.entitlement_key}`} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span className="text-slate-700">
              <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">{e.entitlement_kind}</span>
              {e.entitlement_key}
            </span>
            {e.entitled
              ? <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Entitled</span>
              : <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400"><XCircle className="h-4 w-4" /> Not entitled</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
