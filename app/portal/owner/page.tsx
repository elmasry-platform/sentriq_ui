"use client"

import { useEffect, useState } from "react"
import { UsersRound } from "lucide-react"
import { PortalShell } from "@/components/portal/shell"
import { CompaniesPanel } from "@/components/portal/companies"
import { PortalEmpty, PortalLoading } from "@/components/portal/states"
import { rpc } from "@/lib/portal/api"

interface OperatorRow { user_id: string; operator_role: string; active: boolean; created_at: string }

function RosterPanel({ accessToken }: { accessToken: string }) {
  const [rows, setRows] = useState<OperatorRow[] | null>(null)
  useEffect(() => {
    let active = true
    rpc<{ rows?: OperatorRow[] } | OperatorRow[]>("platform_operator_roster", { p_limit: 100 }, accessToken)
      .then((r) => { if (active) setRows(Array.isArray(r) ? r : r.rows ?? []) })
      .catch(() => { if (active) setRows([]) })
    return () => { active = false }
  }, [accessToken])
  if (!rows) return <PortalLoading label="Loading operators" />
  if (rows.length === 0) return <PortalEmpty title="No operators" hint="Platform operators will appear here." />
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.user_id} className="border-b border-slate-50 last:border-0">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><UsersRound className="h-4 w-4" /></div>
                  <span className="font-mono text-xs text-slate-600">{o.user_id}</span>
                </div>
              </td>
              <td className="px-4 py-3 font-medium capitalize text-slate-800">{o.operator_role}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${o.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {o.active ? "Active" : "Inactive"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function OwnerPortal() {
  return (
    <PortalShell expect="owner" title="Platform overview" subtitle="Companies, operators, and lifecycle controls across the platform.">
      {({ session }) => (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Companies</h2>
            <CompaniesPanel accessToken={session.accessToken} allowLifecycle />
          </section>
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Platform operators</h2>
            <RosterPanel accessToken={session.accessToken} />
          </section>
        </div>
      )}
    </PortalShell>
  )
}
