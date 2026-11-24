"use client"

import { useEffect, useState } from "react"
import { UserRound, KeyRound, LoaderCircle } from "lucide-react"
import { rpc, select } from "@/lib/portal/api"
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
      setGrantError(e instanceof Error ? e.message : "permission_update_failed")
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
            <th className="px-4 py-3">Member</th><th className="px-4 py-3">Level</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Access</th>
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
              <td className="px-4 py-3 text-right">
                <button onClick={() => { setGrantFor(m); setGrantError(null); setReason("") }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                  <KeyRound className="h-3.5 w-3.5" /> Permissions
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {grantFor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Set a permission decision</h3>
            <p className="mt-1 text-sm text-slate-500">
              For {grantFor.displayName ?? grantFor.email ?? "member"} in your company. You can only grant within your own authority. Audited.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-slate-700">Permission
                <select value={permKey} onChange={(e) => setPermKey(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  {PERMISSION_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-700">Decision
                <select value={decision} onChange={(e) => setDecision(e.target.value as "allow" | "deny")} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="allow">Allow</option>
                  <option value="deny">Deny</option>
                </select>
              </label>
              <div className="flex gap-5 text-sm text-slate-700">
                <label className="flex items-center gap-2"><input type="checkbox" checked={canRead} onChange={(e) => setCanRead(e.target.checked)} /> Read</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={canWrite} onChange={(e) => setCanWrite(e.target.checked)} /> Write</label>
              </div>
              <label className="block text-xs font-semibold text-slate-700">Reason (min 3 characters)
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" />
              </label>
              {grantError ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{grantError}</p> : null}
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setGrantFor(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={saveDecision} disabled={reason.trim().length < 3 || busy} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null} Save decision
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
