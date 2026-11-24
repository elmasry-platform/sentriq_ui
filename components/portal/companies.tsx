"use client"

import { useCallback, useEffect, useState } from "react"
import { Building2, PauseCircle, PlayCircle, LoaderCircle, ChevronRight } from "lucide-react"
import { rpc, ApiError } from "@/lib/portal/api"
import { PortalEmpty, PortalError, PortalLoading } from "./states"

export interface CompanyRow { id: string; name: string; industry_label: string | null; status: string; created_at: string }

function StatusBadge({ status }: { status: string }) {
  const tone = status === "active" ? "bg-emerald-50 text-emerald-700" : status === "suspended" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${tone}`}>{status}</span>
}

export function CompaniesPanel({ accessToken, allowLifecycle, onOpen }: { accessToken: string; allowLifecycle: boolean; onOpen?: (company: CompanyRow) => void }) {
  const [rows, setRows] = useState<CompanyRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [denied, setDenied] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pending, setPending] = useState<{ company: CompanyRow; status: "active" | "suspended" } | null>(null)
  const [reason, setReason] = useState("")
  const [tick, setTick] = useState(0)

  const load = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let active = true
    setError(null)
    rpc<{ rows: CompanyRow[] }>("platform_list_companies", { p_limit: 100 }, accessToken)
      .then((res) => { if (active) { setRows(res.rows ?? []); setDenied(false) } })
      .catch((e) => {
        if (!active) return
        if (e instanceof ApiError && e.status === 403) { setDenied(true); setRows([]) }
        else setError(e instanceof Error ? e.message : "companies_load_failed")
      })
    return () => { active = false }
  }, [accessToken, tick])

  async function confirmStatus() {
    if (!pending || reason.trim().length < 3) return
    const { company, status } = pending
    setBusyId(company.id)
    try {
      await rpc("platform_set_tenant_status", { p_tenant_id: company.id, p_status: status, p_reason: reason.trim() }, accessToken)
      setPending(null)
      setReason("")
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "status_update_failed")
    } finally {
      setBusyId(null)
    }
  }

  if (error) return <PortalError message={error} onRetry={load} />
  if (!rows) return <PortalLoading label="Loading companies" />
  if (denied) return <PortalEmpty title="Company list not available" hint="Your platform role does not include the company directory permission." />
  if (rows.length === 0) return <PortalEmpty title="No companies yet" hint="Companies created on the platform will appear here." />

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Company</th>
            <th className="px-4 py-3">Industry</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Created</th>
            {allowLifecycle ? <th className="px-4 py-3 text-right">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Building2 className="h-4 w-4" /></div>
                  {onOpen ? (
                    <button onClick={() => onOpen(c)} className="inline-flex items-center gap-1 font-medium text-slate-800 hover:text-slate-950 hover:underline">
                      {c.name}<ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                  ) : (
                    <span className="font-medium text-slate-800">{c.name}</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-slate-500">{c.industry_label ?? "-"}</td>
              <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
              <td className="px-4 py-3 text-slate-500">{new Date(c.created_at).toLocaleDateString()}</td>
              {allowLifecycle ? (
                <td className="px-4 py-3 text-right">
                  {busyId === c.id ? <LoaderCircle className="ml-auto h-4 w-4 animate-spin text-slate-400" /> : c.status === "active" ? (
                    <button onClick={() => { setPending({ company: c, status: "suspended" }); setReason("") }} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50">
                      <PauseCircle className="h-3.5 w-3.5" /> Suspend
                    </button>
                  ) : c.status === "suspended" ? (
                    <button onClick={() => { setPending({ company: c, status: "active" }); setReason("") }} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
                      <PlayCircle className="h-3.5 w-3.5" /> Reactivate
                    </button>
                  ) : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {pending ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              {pending.status === "suspended" ? "Suspend" : "Reactivate"} {pending.company.name}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {pending.status === "suspended"
                ? "Members of this company immediately lose access until it is reactivated. This action is audited."
                : "The company and its members regain access. This action is audited."}
            </p>
            <label className="mt-4 block text-xs font-semibold text-slate-700" htmlFor="reason">Reason (min 3 characters)</label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              placeholder="e.g. Missed payment follow-up"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setPending(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={confirmStatus}
                disabled={reason.trim().length < 3 || busyId !== null}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${pending.status === "suspended" ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
              >
                {busyId ? "Working..." : pending.status === "suspended" ? "Suspend company" : "Reactivate company"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
