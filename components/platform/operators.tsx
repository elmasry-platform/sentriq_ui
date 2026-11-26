"use client"

import { Fragment, useCallback, useEffect, useState } from "react"
import { ChevronDown, ChevronUp, LoaderCircle, UsersRound } from "lucide-react"
import { rpc } from "@/lib/portal/api"
import { useFriendlyError, useT, type CopyKey } from "@/lib/portal/i18n"
import { PortalEmpty, PortalError, PortalLoading } from "@/components/portal/states"

interface OperatorRow { user_id: string; operator_role: string; active: boolean; created_at: string; email?: string | null }
interface PermissionRow { permission_key: string; granted: boolean; explicit_row: { granted: boolean; reason: string; updated_at: string } | null }

const KNOWN_POWERS = [
  "company.close", "company.rename", "company.create", "company.lifecycle",
  "module.toggle", "feature.toggle", "plan.publish",
  "subscription.create", "subscription.update",
  "entitlement.issue", "entitlement.revoke", "entitlement.status",
  "delegation.review", "delegation.revoke",
  "membership.lifecycle", "member.permissions", "member.entitlements", "superadmin.invite", "superadmin.capability",
] as const

function powerLabel(t: (key: CopyKey) => string, key: string): string {
  return (KNOWN_POWERS as readonly string[]).includes(key) ? t(`power.${key}` as CopyKey) : key
}

/** Owner's per-power control over a sub-owner: current state always visible,
 *  segmented Granted/Withdrawn, one audited reason per save. */
function PermissionMatrix({ accessToken, userId }: { accessToken: string; userId: string }) {
  const t = useT()
  const fe = useFriendlyError()
  const [rows, setRows] = useState<PermissionRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [changes, setChanges] = useState<Record<string, boolean>>({})
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const load = useCallback(() => setTick((n) => n + 1), [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let active = true
    rpc<{ rows?: PermissionRow[] } | PermissionRow[]>("platform_subowner_permissions", { p_user_id: userId }, accessToken)
      .then((res) => { if (active) setRows((Array.isArray(res) ? res : res.rows ?? []).slice().sort((a, b) => a.permission_key.localeCompare(b.permission_key))) })
      .catch((e) => { if (active) setError(fe(e)) })
    return () => { active = false }
  }, [accessToken, userId, tick])

  async function save() {
    const entries = Object.entries(changes)
    if (entries.length === 0 || reason.trim().length < 3) return
    setBusy(true)
    setSaveError(null)
    try {
      for (const [key, granted] of entries) {
        await rpc("set_subowner_platform_permission", {
          p_user_id: userId, p_permission_key: key, p_granted: granted, p_reason: reason.trim(),
        }, accessToken)
      }
      setChanges({})
      setReason("")
      load()
    } catch (e) {
      setSaveError(fe(e))
    } finally {
      setBusy(false)
    }
  }

  if (error) return <PortalError message={error} onRetry={load} />
  if (!rows) return <PortalLoading label={t("perms.loading")} />

  const dirty = Object.keys(changes).length > 0

  return (
    <div className="access-editor">
      {rows.map((row) => {
        const state = changes[row.permission_key] ?? row.granted
        return (
          <div key={row.permission_key} className="access-row">
            <div className="access-row-name">
              <strong>{powerLabel(t, row.permission_key)}</strong>
              <span>{row.permission_key}</span>
            </div>
            <div className="seg" role="group" aria-label={powerLabel(t, row.permission_key)}>
              <button type="button" className={`seg-option${state ? " seg-on-allow" : ""}`} aria-pressed={state}
                onClick={() => setChanges((prev) => { const next = { ...prev }; if (row.granted === true) delete next[row.permission_key]; else next[row.permission_key] = true; return next })}>
                {t("perms.granted")}{state ? " ✓" : ""}
              </button>
              <button type="button" className={`seg-option${!state ? " seg-on-deny" : ""}`} aria-pressed={!state}
                onClick={() => setChanges((prev) => { const next = { ...prev }; if (row.granted === false) delete next[row.permission_key]; else next[row.permission_key] = false; return next })}>
                {t("perms.withdrawn")}{!state ? " ✓" : ""}
              </button>
            </div>
            <div className="access-row-state">
              <span className={`ux-badge ${state ? "b-blue" : "b-red"}`}>
                {state ? t("perms.granted") : t("perms.withdrawn")}{row.explicit_row ? ` · ${t("perms.byYou")}` : ` · ${t("perms.default")}`}
              </span>
            </div>
          </div>
        )
      })}
      {dirty ? (
        <div className="access-save-row">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("perms.reason")} aria-label={t("perms.reason")} />
          <button type="button" className="button-primary" onClick={save} disabled={reason.trim().length < 3 || busy}>
            {busy ? <LoaderCircle size={14} className="spin" /> : null} {t("perms.save")}
          </button>
        </div>
      ) : null}
      {saveError ? <p className="inspection-alert" role="alert">{saveError}</p> : null}
      <p className="access-audit-note">{t("perms.auditNote")}</p>
    </div>
  )
}

/** Platform owner view of platform operators, with per-permission withdrawal for sub-owners. */
export function OperatorsPanel({ accessToken, selfUserId }: { accessToken: string; selfUserId: string }) {
  const t = useT()
  const fe = useFriendlyError()
  const [rows, setRows] = useState<OperatorRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const load = useCallback(() => setTick((n) => n + 1), [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let active = true
    setError(null)
    rpc<{ rows?: OperatorRow[] } | OperatorRow[]>("platform_operator_roster", { p_limit: 100 }, accessToken)
      .then((r) => { if (active) setRows((Array.isArray(r) ? r : r.rows ?? []).filter((o) => o.user_id !== selfUserId)) })
      .catch((e) => { if (active) setError(fe(e)) })
    return () => { active = false }
  }, [accessToken, tick, selfUserId])

  if (error) return <PortalError message={error} onRetry={load} />
  if (!rows) return <PortalLoading label={t("operators.loading")} />
  if (rows.length === 0) return <PortalEmpty title={t("operators.empty.title")} hint={t("operators.empty.hint")} />

  return (
    <div className="panel platform-panel">
      <div className="panel-header">
        <div>
          <h2>{t("operators.title")}</h2>
        </div>
      </div>
      <table className="data-table">
        <thead>
          <tr><th>{t("operators.operator")}</th><th>{t("operators.role")}</th><th>{t("operators.status")}</th><th>{t("operators.permissions")}</th></tr>
        </thead>
        <tbody>
          {rows.map((o) => {
            const manageable = o.operator_role === "subowner"
            const open = openId === o.user_id
            return (
              <Fragment key={o.user_id}>
                <tr>
                  <td>
                    <div className="platform-person">
                      <span className="avatar" aria-hidden="true"><UsersRound size={14} /></span>
                      <span>
                        <strong className="platform-cell-strong">{o.email ?? t("operators.fallback")}</strong>
                        <span className="platform-perm-key">{o.user_id.slice(0, 8)}…</span>
                      </span>
                    </div>
                  </td>
                  <td>{o.operator_role === "subowner" ? t("role.subowner") : o.operator_role}</td>
                  <td><span className={`ux-badge ${o.active ? "ux-badge-approved" : "ux-badge-returned"}`}>{o.active ? t("operators.state.active") : t("operators.state.inactive")}</span></td>
                  <td>
                    {manageable ? (
                      <button type="button" className="button-outline" onClick={() => setOpenId(open ? null : o.user_id)} aria-expanded={open}>
                        {t("operators.permissions")} {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    ) : <span className="platform-muted">{t("operators.ownerOnly")}</span>}
                  </td>
                </tr>
                {open ? (
                  <tr className="access-editor-row">
                    <td colSpan={4}>
                      <PermissionMatrix accessToken={accessToken} userId={o.user_id} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
