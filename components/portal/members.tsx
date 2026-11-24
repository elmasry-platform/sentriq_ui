"use client"

import { useEffect, useState } from "react"
import { UserRound } from "lucide-react"
import { select } from "@/lib/portal/api"
import { PortalEmpty, PortalError, PortalLoading } from "./states"

interface MemberRow { id: string; membershipId: string; role: string; status: string; displayName: string | null; email: string | null }

const LEVEL_LABEL: Record<string, string> = {
  company_superadmin: "Superadmin",
  company_admin: "Admin",
  employee: "Employee",
}

export function MembersPanel({ accessToken, tenantId, selfUserId }: { accessToken: string; tenantId: string; selfUserId: string }) {
  const [rows, setRows] = useState<MemberRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let active = true
    setError(null)
    select<MemberRow[]>("v_memberships", {
      workspaceId: `eq.${tenantId}`,
      select: "id,membershipId,role,status,displayName,email",
      order: "role.asc",
    }, accessToken)
      .then((r) => { if (active) setRows(r) })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "members_load_failed") })
    return () => { active = false }
  }, [accessToken, tenantId, tick])

  if (error) return <PortalError message={error} onRetry={() => setTick((t) => t + 1)} />
  if (!rows) return <PortalLoading label="Loading members" />
  if (rows.length === 0) return <PortalEmpty title="No members visible" hint="Members of this company will appear here." />

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Member</th><th className="px-4 py-3">Level</th><th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.membershipId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><UserRound className="h-4 w-4" /></div>
                  <span className="font-medium text-slate-800">
                    {m.displayName ?? m.email ?? "Member"}{m.id === selfUserId ? <span className="ml-1.5 text-xs font-normal text-slate-400">(you)</span> : null}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-slate-600">{LEVEL_LABEL[m.role] ?? m.role}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${m.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{m.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
