"use client"

import { Fragment, useCallback, useEffect, useState } from "react"
import { ChevronDown, ChevronUp, KeyRound, LoaderCircle, UsersRound } from "lucide-react"
import { rpc } from "@/lib/portal/api"
import { friendlyError } from "@/lib/portal/errors"
import { Dialog } from "@/components/sentriq/dialog"
import { EmptyState, ErrorState, LoadingState } from "@/components/sentriq/states"

interface OperatorRow { user_id: string; operator_role: string; active: boolean; created_at: string; email?: string | null }
interface PermissionRow { permission_key: string; granted: boolean; explicit_row: { granted: boolean; reason: string; updated_at: string } | null }

const PERMISSION_LABEL: Record<string, string> = {
  "company.close": "Close companies",
  "company.rename": "Rename companies",
  "company.create": "Create companies",
  "company.lifecycle": "Suspend & reactivate companies",
  "module.toggle": "Toggle modules",
  "feature.toggle": "Toggle features",
  "plan.publish": "Publish plans",
  "subscription.create": "Create subscriptions",
  "subscription.update": "Update subscriptions",
  "entitlement.issue": "Issue entitlements",
  "entitlement.revoke": "Revoke entitlements",
  "entitlement.status": "Change entitlement status",
  "delegation.review": "Review delegations",
  "delegation.revoke": "Revoke delegations",
  "membership.lifecycle": "Suspend & reactivate members",
  "superadmin.invite": "Invite company superadmins",
  "superadmin.capability": "Set superadmin capabilities",
}

function PermissionMatrix({ accessToken, userId }: { accessToken: string; userId: string }) {
  const [rows, setRows] = useState<PermissionRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [pending, setPending] = useState<{ row: PermissionRow; next: boolean } | null>(null)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const load = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let active = true
    rpc<{ rows?: PermissionRow[] } | PermissionRow[]>("platform_subowner_permissions", { p_user_id: userId }, accessToken)
      .then((res) => { if (active) setRows((Array.isArray(res) ? res : res.rows ?? []).slice().sort((a, b) => a.permission_key.localeCompare(b.permission_key))) })
      .catch((e) => { if (active) setError(friendlyError(e, "Permissions could not be loaded. Try again.")) })
    return () => { active = false }
  }, [accessToken, userId, tick])

  async function confirm() {
    if (!pending || reason.trim().length < 3) return
    setBusy(true)
    setSaveError(null)
    try {
      await rpc("set_subowner_platform_permission", {
        p_user_id: userId,
        p_permission_key: pending.row.permission_key,
        p_granted: pending.next,
        p_reason: reason.trim(),
      }, accessToken)
      setPending(null)
      setReason("")
      load()
    } catch (e) {
      setSaveError(friendlyError(e, "The permission change failed. Try again."))
    } finally {
      setBusy(false)
    }
  }

  if (error) return <ErrorState title={error} onRetry={load} retryLabel="Try again" />
  if (!rows) return <LoadingState label="Loading permissions" />

  return (
    <>
      <table className="data-table">
        <thead>
          <tr><th>Permission</th><th>State</th><th>Source</th><th>Action</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.permission_key}>
              <td>
                <strong className="platform-perm-name">{PERMISSION_LABEL[row.permission_key] ?? row.permission_key}</strong>
                <span className="platform-perm-key">{row.permission_key}</span>
              </td>
              <td>
                <span className={`ux-badge ${row.granted ? "ux-badge-approved" : "ux-badge-overdue"}`}>{row.granted ? "Granted" : "Withdrawn"}</span>
              </td>
              <td>{row.explicit_row ? "Set by you" : "Default"}</td>
              <td>
                <button type="button" className="button-outline" onClick={() => { setPending({ row, next: !row.granted }); setReason(""); setSaveError(null) }}>
                  {row.granted ? "Withdraw" : "Restore"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {pending ? (
        <Dialog title={`${pending.next ? "Restore" : "Withdraw"} ${PERMISSION_LABEL[pending.row.permission_key] ?? pending.row.permission_key}`} closeLabel="Cancel" onClose={() => setPending(null)}>
          <p className="ux-dialog-hint">
            {pending.next
              ? "The sub-owner regains this platform power. This change is audited."
              : "The sub-owner immediately loses this platform power until you restore it. This change is audited."}
          </p>
          <label>Reason (min 3 characters)
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} data-autofocus rows={2} />
          </label>
          {saveError ? <p className="inspection-alert">{saveError}</p> : null}
          <div className="inspection-modal-actions">
            <button type="button" className="button-outline" onClick={() => setPending(null)}>Cancel</button>
            <button type="button" className="button-primary" onClick={confirm} disabled={reason.trim().length < 3 || busy}>
              {busy ? <LoaderCircle size={14} className="spin" /> : null}
              {pending.next ? "Restore permission" : "Withdraw permission"}
            </button>
          </div>
        </Dialog>
      ) : null}
    </>
  )
}

/** Platform owner view of platform operators, with per-permission withdrawal for sub-owners. */
export function OperatorsPanel({ accessToken, selfUserId }: { accessToken: string; selfUserId: string }) {
  const [rows, setRows] = useState<OperatorRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const load = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let active = true
    setError(null)
    rpc<{ rows?: OperatorRow[] } | OperatorRow[]>("platform_operator_roster", { p_limit: 100 }, accessToken)
      .then((r) => { if (active) setRows(Array.isArray(r) ? r : r.rows ?? []) })
      .catch((e) => { if (active) setError(friendlyError(e, "Operators could not be loaded. Try again.")) })
    return () => { active = false }
  }, [accessToken, tick])

  if (error) return <ErrorState title={error} onRetry={load} retryLabel="Try again" />
  if (!rows) return <LoadingState label="Loading operators" />
  if (rows.length === 0) return <EmptyState title="No operators" hint="Platform operators will appear here." />

  return (
    <div className="panel platform-panel">
      <div className="panel-header">
        <div>
          <h2>Platform operators</h2>
          <p>Sub-owners hold every platform power by default. Open one to withdraw a specific power.</p>
        </div>
      </div>
      <table className="data-table">
        <thead>
          <tr><th>Operator</th><th>Role</th><th>Status</th><th>Permissions</th></tr>
        </thead>
        <tbody>
          {rows.map((o) => {
            const isSelf = o.user_id === selfUserId
            const manageable = o.operator_role === "subowner" && !isSelf
            const open = openId === o.user_id
            return (
              <FragmentRow
                key={o.user_id}
                operator={o}
                isSelf={isSelf}
                manageable={manageable}
                open={open}
                onToggle={() => setOpenId(open ? null : o.user_id)}
                accessToken={accessToken}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function FragmentRow({ operator: o, isSelf, manageable, open, onToggle, accessToken }: { operator: OperatorRow; isSelf: boolean; manageable: boolean; open: boolean; onToggle: () => void; accessToken: string }) {
  return (
    <Fragment>
      <tr>
        <td>
          <div className="platform-person">
            <span className="avatar" aria-hidden="true"><UsersRound size={14} /></span>
            <span>
              <strong className="platform-cell-strong">{o.email ?? "Operator"}{isSelf ? <em> (you)</em> : null}</strong>
              <span className="platform-perm-key">{o.user_id.slice(0, 8)}…</span>
            </span>
          </div>
        </td>
        <td className="platform-capitalize">{o.operator_role}</td>
        <td><span className={`ux-badge ${o.active ? "ux-badge-approved" : "ux-badge-returned"}`}>{o.active ? "Active" : "Inactive"}</span></td>
        <td>
          {manageable ? (
            <button type="button" className="button-outline" onClick={onToggle} aria-expanded={open}>
              <KeyRound size={13} /> Permissions {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          ) : <span className="platform-muted">{isSelf ? "Your account" : "Owner only"}</span>}
        </td>
      </tr>
      {open ? (
        <tr className="platform-perms-row">
          <td colSpan={4}>
            <PermissionMatrix accessToken={accessToken} userId={o.user_id} />
          </td>
        </tr>
      ) : null}
    </Fragment>
  )
}
