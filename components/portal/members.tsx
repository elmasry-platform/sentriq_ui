"use client"

import { useEffect, useState } from "react"
import { KeyRound, LoaderCircle, UserRound } from "lucide-react"
import { rpc, select } from "@/lib/portal/api"
import { Dialog } from "@/components/sentriq/dialog"
import { friendlyError } from "@/lib/portal/errors"
import { PortalEmpty, PortalError, PortalLoading } from "./states"

const PERMISSION_KEYS = ["hse.dashboard", "hse.inspections", "hse.forms", "hse.actions", "hse.reports"]

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
  const [grantFor, setGrantFor] = useState<MemberRow | null>(null)
  const [permKey, setPermKey] = useState(PERMISSION_KEYS[1])
  const [decision, setDecision] = useState<"allow" | "deny">("allow")
  const [canRead, setCanRead] = useState(true)
  const [canWrite, setCanWrite] = useState(false)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [grantError, setGrantError] = useState<string | null>(null)

  async function saveDecision() {
    if (!grantFor || reason.trim().length < 3) return
    setBusy(true)
    setGrantError(null)
    try {
      await rpc("set_member_permission_decision", {
        p_tenant_id: tenantId,
        p_membership_id: grantFor.membershipId,
        p_permission_key: permKey,
        p_decision: decision,
        p_scope_kind: "tenant",
        p_site_id: null,
        p_org_unit_id: null,
        p_task_kind: null,
        p_task_id: null,
        p_can_read: canRead,
        p_can_write: canWrite,
        p_ends_at: null,
        p_exception_kind: null,
        p_reason: reason.trim(),
      }, accessToken)
      setGrantFor(null)
      setReason("")
    } catch (e) {
      setGrantError(friendlyError(e, "The permission change failed. Try again."))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    let active = true
    setError(null)
    select<MemberRow[]>("v_memberships", {
      workspaceId: `eq.${tenantId}`,
      select: "id,membershipId,role,status,displayName,email",
      order: "role.asc",
    }, accessToken)
      .then((r) => { if (active) setRows(r.filter((m) => m.id !== selfUserId)) })
      .catch((e) => { if (active) setError(friendlyError(e, "Members could not be loaded. Try again.")) })
    return () => { active = false }
  }, [accessToken, tenantId, tick])

  if (error) return <PortalError message={error} onRetry={() => setTick((t) => t + 1)} />
  if (!rows) return <PortalLoading label="Loading members" />
  if (rows.length === 0) return <PortalEmpty title="No members visible" hint="Members of this company will appear here." />

  return (
    <div className="panel platform-panel">
      <div className="panel-header">
        <div>
          <h2>Members</h2>
          <p>People in your company. Set permission decisions within your own authority; every decision is audited.</p>
        </div>
      </div>
      <table className="data-table">
        <thead>
          <tr><th>Member</th><th>Level</th><th>Status</th><th>Access</th></tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.membershipId}>
              <td>
                <div className="platform-person">
                  <span className="avatar" aria-hidden="true"><UserRound size={14} /></span>
                  <strong className="platform-cell-strong">
                    {m.displayName ?? m.email ?? "Member"}
                  </strong>
                </div>
              </td>
              <td>{LEVEL_LABEL[m.role] ?? m.role}</td>
              <td>
                <span className={`ux-badge platform-capitalize ${m.status === "active" ? "ux-badge-approved" : "ux-badge-returned"}`}>{m.status}</span>
              </td>
              <td>
                <button type="button" onClick={() => { setGrantFor(m); setGrantError(null); setReason("") }} className="button-outline">
                  <KeyRound size={13} /> Permissions
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {grantFor ? (
        <Dialog title="Set a permission decision" closeLabel="Cancel" onClose={() => setGrantFor(null)}>
          <p className="ux-dialog-hint">
            For {grantFor.displayName ?? grantFor.email ?? "member"} in your company. You can only grant within your own authority. Audited.
          </p>
          <label>Permission
            <select value={permKey} onChange={(e) => setPermKey(e.target.value)}>
              {PERMISSION_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <label>Decision
            <select value={decision} onChange={(e) => setDecision(e.target.value as "allow" | "deny")}>
              <option value="allow">Allow</option>
              <option value="deny">Deny</option>
            </select>
          </label>
          <div className="platform-check-row">
            <label className="platform-check"><input type="checkbox" checked={canRead} onChange={(e) => setCanRead(e.target.checked)} /> Read</label>
            <label className="platform-check"><input type="checkbox" checked={canWrite} onChange={(e) => setCanWrite(e.target.checked)} /> Write</label>
          </div>
          <label>Reason (min 3 characters)
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </label>
          {grantError ? <p className="inspection-alert">{grantError}</p> : null}
          <div className="inspection-modal-actions">
            <button type="button" className="button-outline" onClick={() => setGrantFor(null)}>Cancel</button>
            <button type="button" className="button-primary" onClick={saveDecision} disabled={reason.trim().length < 3 || busy}>
              {busy ? <LoaderCircle size={14} className="spin" /> : null} Save decision
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  )
}
