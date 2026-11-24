"use client"

import { useCallback, useEffect, useState } from "react"
import { Building2, ChevronRight, LoaderCircle, PauseCircle, PlayCircle } from "lucide-react"
import { rpc, ApiError } from "@/lib/portal/api"
import { friendlyError } from "@/lib/portal/errors"
import { Dialog } from "@/components/sentriq/dialog"
import { PortalEmpty, PortalError, PortalLoading } from "./states"

export interface CompanyRow { id: string; name: string; industry_label: string | null; status: string; created_at: string }

export function CompanyStatusBadge({ status }: { status: string }) {
  const tone = status === "active" ? "ux-badge-approved" : status === "suspended" ? "ux-badge-in-review" : "ux-badge-returned"
  return <span className={`ux-badge ${tone} platform-capitalize`}>{status}</span>
}

export function CompaniesPanel({ accessToken, allowLifecycle, canLifecycle = true, onOpen }: { accessToken: string; allowLifecycle: boolean; canLifecycle?: boolean; onOpen?: (company: CompanyRow) => void }) {
  const [rows, setRows] = useState<CompanyRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [denied, setDenied] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pending, setPending] = useState<{ company: CompanyRow; status: "active" | "suspended" } | null>(null)
  const [reason, setReason] = useState("")
  const [saveError, setSaveError] = useState<string | null>(null)
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
        else setError(friendlyError(e, "Companies could not be loaded. Try again."))
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
      setSaveError(null)
      load()
    } catch (e) {
      setSaveError(friendlyError(e, "The status change failed. Try again."))
    } finally {
      setBusyId(null)
    }
  }

  if (error) return <PortalError message={error} onRetry={load} />
  if (!rows) return <PortalLoading label="Loading companies" />
  if (denied) return <PortalEmpty title="Company list not available" hint="Your platform role does not include the company directory permission." />
  if (rows.length === 0) return <PortalEmpty title="No companies yet" hint="Companies created on the platform will appear here." />

  return (
    <div className="panel platform-panel">
      <div className="panel-header">
        <div>
          <h2>All companies</h2>
          <p>Every company on the platform. Lifecycle changes are audited.</p>
        </div>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Industry</th>
            <th>Status</th>
            <th>Created</th>
            {allowLifecycle || onOpen ? <th>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td>
                <div className="platform-person">
                  <span className="avatar" aria-hidden="true"><Building2 size={14} /></span>
                  {onOpen ? (
                    <button type="button" onClick={() => onOpen(c)} className="platform-link-button">
                      {c.name}<ChevronRight size={13} />
                    </button>
                  ) : (
                    <strong className="platform-cell-strong">{c.name}</strong>
                  )}
                </div>
              </td>
              <td>{c.industry_label ?? "—"}</td>
              <td><CompanyStatusBadge status={c.status} /></td>
              <td>{new Date(c.created_at).toLocaleDateString()}</td>
              {allowLifecycle || onOpen ? (
                <td>
                  {busyId === c.id ? <LoaderCircle size={15} className="spin platform-muted" /> : allowLifecycle && canLifecycle && c.status === "active" ? (
                    <button type="button" onClick={() => { setPending({ company: c, status: "suspended" }); setReason(""); setSaveError(null) }} className="button-outline platform-warn">
                      <PauseCircle size={13} /> Suspend
                    </button>
                  ) : allowLifecycle && canLifecycle && c.status === "suspended" ? (
                    <button type="button" onClick={() => { setPending({ company: c, status: "active" }); setReason(""); setSaveError(null) }} className="button-outline platform-ok">
                      <PlayCircle size={13} /> Reactivate
                    </button>
                  ) : onOpen ? (
                    <button type="button" onClick={() => onOpen(c)} className="button-outline">Open</button>
                  ) : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {pending ? (
        <Dialog title={`${pending.status === "suspended" ? "Suspend" : "Reactivate"} ${pending.company.name}`} closeLabel="Cancel" onClose={() => setPending(null)}>
          <p className="ux-dialog-hint">
            {pending.status === "suspended"
              ? "Members of this company immediately lose access until it is reactivated. This action is audited."
              : "The company and its members regain access. This action is audited."}
          </p>
          <label>Reason (min 3 characters)
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="e.g. Missed payment follow-up" data-autofocus />
          </label>
          {saveError ? <p className="inspection-alert" role="alert">{saveError}</p> : null}
          <div className="inspection-modal-actions">
            <button type="button" className="button-outline" onClick={() => setPending(null)}>Cancel</button>
            <button type="button" onClick={confirmStatus} disabled={reason.trim().length < 3 || busyId !== null} className="button-primary">
              {busyId ? <LoaderCircle size={14} className="spin" /> : null}
              {pending.status === "suspended" ? "Suspend company" : "Reactivate company"}
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  )
}
