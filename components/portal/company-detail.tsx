"use client"

import { useCallback, useEffect, useState } from "react"
import { UserRound, X, PauseCircle, PlayCircle, LoaderCircle } from "lucide-react"
import { rpc } from "@/lib/portal/api"
import type { CompanyRow } from "./companies"
import { PortalEmpty, PortalError, PortalLoading } from "./states"

interface CompanyMemberRow { id: string; user_id: string; member_role: string; status: string; display_name: string | null; email: string | null }

const LEVEL_LABEL: Record<string, string> = {
  company_superadmin: "Superadmin",
  company_admin: "Admin",
  employee: "Employee",
}

/** Platform-owner view into one company: its people and their access lifecycle. */
export function CompanyDetail({ accessToken, company, onClose }: { accessToken: string; company: CompanyRow; onClose: () => void }) {
  const [rows, setRows] = useState<CompanyMemberRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [pending, setPending] = useState<{ member: CompanyMemberRow; status: "active" | "suspended" } | null>(null)
  const [reason, setReason] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let active = true
    setRows(null)
    setError(null)
    rpc<{ rows?: CompanyMemberRow[] } | CompanyMemberRow[]>("platform_read_company", { p_tenant_id: company.id, p_resource: "iam.memberships", p_limit: 100 }, accessToken)
      .then((res) => { if (active) setRows(Array.isArray(res) ? res : res.rows ?? []) })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "members_load_failed") })
    return () => { active = false }
  }, [accessToken, company.id, tick])

  async function confirmStatus() {
    if (!pending || reason.trim().length < 3) return
    const { member, status } = pending
    setBusyId(member.id)
    try {
      await rpc("platform_set_membership_status", { p_tenant_id: company.id, p_membership_id: member.id, p_status: status, p_reason: reason.trim() }, accessToken)
      setPending(null)
      setReason("")
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "status_update_failed")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{company.name} — people</h3>
          <p className="text-xs text-slate-500">Members of this company and their access. Every change is audited.</p>
        </div>
        <button onClick={onClose} aria-label="Close company" className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"><X className="h-4 w-4" /></button>
      </div>
      {error ? <div className="p-5"><PortalError message={error} onRetry={load} /></div>
        : !rows ? <div className="p-5"><PortalLoading label="Loading people" /></div>
        : rows.length === 0 ? <div className="p-5"><PortalEmpty title="No members" hint="This company has no memberships yet." /></div>
        : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">Member</th><th className="px-4 py-3">Level</th><th className="px-4 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><UserRound className="h-4 w-4" /></div>
                      <div>
                        <span className="block font-medium text-slate-800">{m.display_name ?? m.email ?? "Member"}</span>
                        <span className="block font-mono text-[11px] text-slate-400">{m.user_id.slice(0, 8)}…</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{LEVEL_LABEL[m.member_role] ?? m.member_role}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${m.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{m.status}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {busyId === m.id ? <LoaderCircle className="ml-auto h-4 w-4 animate-spin text-slate-400" /> : m.status === "active" ? (
                      <button onClick={() => { setPending({ member: m, status: "suspended" }); setReason("") }} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50">
                        <PauseCircle className="h-3.5 w-3.5" /> Suspend
                      </button>
                    ) : (
                      <button onClick={() => { setPending({ member: m, status: "active" }); setReason("") }} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
                        <PlayCircle className="h-3.5 w-3.5" /> Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      {pending ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              {pending.status === "suspended" ? "Suspend" : "Reactivate"} {pending.member.display_name ?? pending.member.email ?? "member"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {pending.status === "suspended"
                ? "This member immediately loses access to the company until reactivated. This action is audited."
                : "The member regains access to the company. This action is audited."}
            </p>
            <label className="mt-4 block text-xs font-semibold text-slate-700" htmlFor="member-reason">Reason (min 3 characters)</label>
            <textarea
              id="member-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setPending(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button
                onClick={confirmStatus}
                disabled={reason.trim().length < 3 || busyId !== null}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${pending.status === "suspended" ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
              >
                {busyId ? "Working..." : pending.status === "suspended" ? "Suspend member" : "Reactivate member"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
