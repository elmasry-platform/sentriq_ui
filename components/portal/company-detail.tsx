"use client"

import { useCallback, useEffect, useState } from "react"
import { LoaderCircle, PauseCircle, PlayCircle, UserRound, X } from "lucide-react"
import { rpc } from "@/lib/portal/api"
import { Dialog } from "@/components/sentriq/dialog"
import type { CompanyRow } from "./companies"
import { PortalEmpty, PortalError, PortalLoading } from "./states"

interface CompanyMemberRow { id: string; user_id: string; member_role: string; status: string; display_name: string | null; email: string | null }

const LEVEL_LABEL: Record<string, string> = {
  company_superadmin: "Superadmin",
  company_admin: "Admin",
  employee: "Employee",
}

/** Platform view into one company: its people and their access lifecycle. */
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
    <section className="panel platform-panel">
      <div className="panel-header">
        <div>
          <h2>{company.name} — people</h2>
          <p>Members of this company and their access. Every change is audited.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close company" className="button-outline platform-icon-button"><X size={15} /></button>
      </div>
      {error ? <PortalError message={error} onRetry={load} />
        : !rows ? <PortalLoading label="Loading people" />
        : rows.length === 0 ? <PortalEmpty title="No members" hint="This company has no memberships yet." />
        : (
          <table className="data-table">
            <thead>
              <tr><th>Member</th><th>Level</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="platform-person">
                      <span className="avatar" aria-hidden="true"><UserRound size={14} /></span>
                      <span>
                        <strong className="platform-cell-strong">{m.display_name ?? m.email ?? "Member"}</strong>
                        <span className="platform-perm-key">{m.user_id.slice(0, 8)}…</span>
                      </span>
                    </div>
                  </td>
                  <td>{LEVEL_LABEL[m.member_role] ?? m.member_role}</td>
                  <td>
                    <span className={`ux-badge platform-capitalize ${m.status === "active" ? "ux-badge-approved" : "ux-badge-returned"}`}>{m.status}</span>
                  </td>
                  <td>
                    {busyId === m.id ? <LoaderCircle size={15} className="spin platform-muted" /> : m.status === "active" ? (
                      <button type="button" onClick={() => { setPending({ member: m, status: "suspended" }); setReason("") }} className="button-outline platform-warn">
                        <PauseCircle size={13} /> Suspend
                      </button>
                    ) : (
                      <button type="button" onClick={() => { setPending({ member: m, status: "active" }); setReason("") }} className="button-outline platform-ok">
                        <PlayCircle size={13} /> Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      {pending ? (
        <Dialog title={`${pending.status === "suspended" ? "Suspend" : "Reactivate"} ${pending.member.display_name ?? pending.member.email ?? "member"}`} closeLabel="Cancel" onClose={() => setPending(null)}>
          <p className="ux-dialog-hint">
            {pending.status === "suspended"
              ? "This member immediately loses access to the company until reactivated. This action is audited."
              : "The member regains access to the company. This action is audited."}
          </p>
          <label>Reason (min 3 characters)
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} data-autofocus />
          </label>
          <div className="inspection-modal-actions">
            <button type="button" className="button-outline" onClick={() => setPending(null)}>Cancel</button>
            <button type="button" className="button-primary" onClick={confirmStatus} disabled={reason.trim().length < 3 || busyId !== null}>
              {busyId ? <LoaderCircle size={14} className="spin" /> : null}
              {pending.status === "suspended" ? "Suspend member" : "Reactivate member"}
            </button>
          </div>
        </Dialog>
      ) : null}
    </section>
  )
}
