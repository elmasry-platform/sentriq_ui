"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { rpc } from "@/lib/portal/api"
import { dateLocale, useFriendlyError, usePortalLang, useT, type CopyKey } from "@/lib/portal/i18n"
import { PortalError, PortalLoading } from "./states"

/** Everything below is rendered from the server's effective-access calculation.
 *  No module, feature or permission key is named here: groups, labels and
 *  choices come from the catalog the server returns. */
interface ModuleState { module_key: string; company_entitled: boolean; state: string }
interface FeatureState { feature_key: string; module_key: string; state: string }
interface GrantRow {
  grant_id: string; module_key: string | null; feature_key: string | null; can_use: boolean; can_delegate: boolean
  starts_at: string; expires_at: string | null; permanent: boolean; reason: string; status: string
  delegated_from_grant_id: string | null; revoke_reason: string | null
}
interface PermissionRow {
  permission_key: string; module_key: string; feature_key: string | null
  entitlement_state: string; functional_state: string; effective: boolean; scoped: boolean
  decision: { deny_id: string | null; allow_id: string | null; reason: string | null; ends_at: string | null }
  lapsed: { kind: string; at: string; reason: string | null } | null
}
interface EffectiveAccess {
  membership: { id: string; role: string; status: string }
  modules: ModuleState[]; features: FeatureState[]; entitlement_grants: GrantRow[]; permissions: PermissionRow[]
}
export interface PlatformMember { membershipId: string; role: string; status: string; displayName: string | null; email: string | null }
type Choice = "default" | "allow" | "deny"

function badgeFor(kind: string): string {
  if (["deny", "restricted", "revoked", "expired"].includes(kind)) return "b-red"
  if (["default_superadmin", "allow", "allow_scoped", "personal_exception", "live"].includes(kind)) return "b-blue"
  if (["company", "inherited", "inherited_scoped"].includes(kind)) return "ux-badge-approved"
  return "b-grey"
}

/** "hse.forms.manage" -> "Forms manage" (display only; the key stays visible). */
function humanize(key: string, moduleKey: string): string {
  const parts = key.split(".").filter((p) => p !== moduleKey)
  const s = (parts.length ? parts : [key]).join(" ").replace(/_/g, " ")
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function currentChoice(p: PermissionRow): Choice {
  if (p.decision.deny_id) return "deny"
  if (p.decision.allow_id) return "allow"
  return "default"
}

/** Platform-operator view of one member's access. Three separate layers: what the
 *  company subscribes to, personal entitlement exceptions or restrictions, and
 *  functional permissions (Default, Allow, Deny). */
export function PlatformMemberAccess({ accessToken, tenantId, member, canPermissions = true, canEntitlements = true }: {
  accessToken: string; tenantId: string; member: PlatformMember; canPermissions?: boolean; canEntitlements?: boolean
}) {
  const t = useT()
  const fe = useFriendlyError()
  const lang = usePortalLang()
  const [data, setData] = useState<EffectiveAccess | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((n) => n + 1), [])

  const [changes, setChanges] = useState<Record<string, Choice>>({})
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const [addMode, setAddMode] = useState<"exception" | "restriction">("exception")
  const [addScope, setAddScope] = useState<"module" | "feature">("feature")
  const [addKey, setAddKey] = useState("")
  const [addDelegate, setAddDelegate] = useState(false)
  const [addExpires, setAddExpires] = useState("")
  const [addReason, setAddReason] = useState("")
  const [revokeId, setRevokeId] = useState<string | null>(null)
  const [revokeReason, setRevokeReason] = useState("")

  useEffect(() => {
    let active = true
    setError(null)
    rpc<EffectiveAccess>("member_effective_access", { p_tenant_id: tenantId, p_membership_id: member.membershipId }, accessToken)
      .then((r) => { if (active) { setData(r); setChanges({}) } })
      .catch((e) => { if (active) setError(fe(e)) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, tenantId, member.membershipId, tick])

  const groups = useMemo(() => {
    const by = new Map<string, PermissionRow[]>()
    for (const p of data?.permissions ?? []) by.set(p.module_key, [...(by.get(p.module_key) ?? []), p])
    return [...by.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [data])

  if (error) return <PortalError message={error} onRetry={reload} />
  if (!data) return <PortalLoading label={t("people.loading")} />

  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(dateLocale(lang)) : "")
  const pending = Object.keys(changes).length
  const targets = addScope === "module" ? data.modules.map((m) => m.module_key) : data.features.map((f) => f.feature_key)

  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true); setActionError(null)
    try { await fn(); after?.(); reload() } catch (e) { setActionError(fe(e)) } finally { setBusy(false) }
  }

  // The server applies one decision per call. On a partial failure we reload the
  // real state (the form is rebuilt from the server) and say how many were saved.
  const saveDecisions = async () => {
    setBusy(true); setActionError(null)
    const entries = Object.entries(changes)
    let saved = 0
    try {
      for (const [key, choice] of entries) {
        await rpc("platform_set_member_decision", {
          p_tenant_id: tenantId, p_membership_id: member.membershipId, p_permission_key: key, p_choice: choice, p_reason: reason.trim(),
        }, accessToken)
        saved += 1
      }
      setReason("")
    } catch (e) {
      setActionError(`${fe(e)} (${saved}/${entries.length})`)
    } finally {
      setBusy(false); reload()
    }
  }

  const addEntitlement = () => run(async () => {
    await rpc("platform_set_member_entitlement", {
      p_tenant_id: tenantId, p_membership_id: member.membershipId,
      p_module_key: addScope === "module" ? addKey : null, p_feature_key: addScope === "feature" ? addKey : null,
      p_reason: addReason.trim(), p_can_use: addMode === "exception",
      p_can_delegate: addMode === "exception" && addDelegate,
      p_expires_at: addExpires ? new Date(`${addExpires}T23:59:59Z`).toISOString() : null,
    }, accessToken)
  }, () => { setAddReason(""); setAddKey(""); setAddExpires(""); setAddDelegate(false) })

  const revoke = () => run(async () => {
    await rpc("platform_revoke_member_entitlement", { p_grant_id: revokeId, p_reason: revokeReason.trim() }, accessToken)
  }, () => { setRevokeId(null); setRevokeReason("") })

  return (
    <div className="access-editor" data-testid="effective-access">
      <h3>{t("ea.title", { name: member.displayName ?? member.email ?? "" })}</h3>
      <p className="access-audit-note">{t("ea.level")}: <strong>{t(`level.${data.membership.role}` as CopyKey)}</strong>. {t("ea.refresh")}</p>

      <section aria-label={t("ea.company.title")}>
        <h4>{t("ea.company.title")}</h4>
        <p className="access-audit-note">{t("ea.company.subtitle")}</p>
        <table className="data-table">
          <thead><tr><th>{t("ea.module")}</th><th>{t("ea.company.entitled")}</th><th>{t("ea.ent.company")}</th></tr></thead>
          <tbody>
            {data.modules.map((m) => (
              <tr key={m.module_key}>
                <td><code>{m.module_key}</code></td>
                <td>{m.company_entitled ? t("ea.company.entitled") : t("ea.company.notEntitled")}</td>
                <td><span className={`ux-badge ${badgeFor(m.state)}`}>{t(`ea.ent.${m.state}` as CopyKey)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-label={t("ea.personal.title")}>
        <h4>{t("ea.personal.title")}</h4>
        <p className="access-audit-note">{t("ea.personal.subtitle")}</p>
        {data.entitlement_grants.length === 0 ? <p className="platform-muted">{t("ea.personal.empty")}</p> : (
          <table className="data-table">
            <thead><tr><th>{t("ea.personal.kind")}</th><th>{t("ea.personal.target")}</th><th>{t("ea.personal.window")}</th><th>{t("ea.personal.delegate")}</th><th>{t("ea.personal.status")}</th><th>{t("ea.personal.reason")}</th><th></th></tr></thead>
            <tbody>
              {data.entitlement_grants.map((g) => (
                <tr key={g.grant_id}>
                  <td><span className={`ux-badge ${g.can_use ? "b-blue" : "b-red"}`}>{g.can_use ? t("ea.kind.exception") : t("ea.kind.restriction")}</span></td>
                  <td><code>{g.feature_key ?? g.module_key}</code>{g.delegated_from_grant_id ? <div className="platform-muted">{t("ea.personal.delegated")}</div> : null}</td>
                  <td>{g.permanent ? `${fmt(g.starts_at)} · ${t("ea.personal.permanent")}` : t("ea.personal.until", { from: fmt(g.starts_at), to: fmt(g.expires_at) })}</td>
                  <td>{g.can_delegate ? "✓" : "—"}</td>
                  <td><span className={`ux-badge ${badgeFor(g.status)}`}>{t(`ea.status.${g.status}` as CopyKey)}</span></td>
                  <td>{g.status === "revoked" && g.revoke_reason ? `${g.reason} / ${g.revoke_reason}` : g.reason}</td>
                  <td>
                    {canEntitlements && g.status === "live" && !g.delegated_from_grant_id ? (
                      revokeId === g.grant_id ? (
                        <span className="access-save-row">
                          <input value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} placeholder={t("ea.personal.revokeReason")} aria-label={t("ea.personal.revokeReason")} />
                          <button type="button" className="button-primary" disabled={busy || revokeReason.trim().length < 3} onClick={revoke}>{t("ea.personal.revoke")}</button>
                        </span>
                      ) : <button type="button" className="button-outline" onClick={() => setRevokeId(g.grant_id)}>{t("ea.personal.revoke")}</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {canEntitlements ? (
          <div className="access-save-row" role="group" aria-label={t(addMode === "exception" ? "ea.add.exception" : "ea.add.restriction")}>
            <select value={addMode} onChange={(e) => setAddMode(e.target.value as "exception" | "restriction")} aria-label={t("ea.personal.kind")}>
              <option value="exception">{t("ea.add.exception")}</option>
              <option value="restriction">{t("ea.add.restriction")}</option>
            </select>
            <select value={addScope} onChange={(e) => { setAddScope(e.target.value as "module" | "feature"); setAddKey("") }} aria-label={t("ea.personal.target")}>
              <option value="feature">{t("ea.add.scope.feature")}</option>
              <option value="module">{t("ea.add.scope.module")}</option>
            </select>
            <select value={addKey} onChange={(e) => setAddKey(e.target.value)} aria-label={t("ea.personal.target")}>
              <option value="">—</option>
              {targets.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <label>{t("ea.add.expires")} <input type="date" value={addExpires} onChange={(e) => setAddExpires(e.target.value)} /></label>
            {addMode === "exception" ? (
              <label><input type="checkbox" checked={addDelegate} onChange={(e) => setAddDelegate(e.target.checked)} /> {t("ea.add.delegate")}</label>
            ) : null}
            <input value={addReason} onChange={(e) => setAddReason(e.target.value)} placeholder={t("ea.personal.reason")} aria-label={t("ea.personal.reason")} />
            <button type="button" className="button-primary" disabled={busy || !addKey || addReason.trim().length < 3} onClick={addEntitlement}>
              {busy ? <LoaderCircle size={14} className="spin" /> : null} {t("ea.add.submit")}
            </button>
          </div>
        ) : <p className="platform-muted">{t("ea.noPower.entitlements")}</p>}
      </section>

      <section aria-label={t("ea.perms.title")}>
        <h4>{t("ea.perms.title")}</h4>
        <p className="access-audit-note">{t("ea.perms.subtitle")}</p>
        {groups.map(([moduleKey, rows]) => (
          <div key={moduleKey} className="access-group">
            <h5><code>{moduleKey}</code></h5>
            {rows.map((p) => {
              const choice = changes[p.permission_key] ?? currentChoice(p)
              const canAllow = p.entitlement_state === "company" || p.entitlement_state === "personal_exception"
              return (
                <div key={p.permission_key} className="access-row" data-permission={p.permission_key}>
                  <div>
                    <strong>{humanize(p.permission_key, moduleKey)}</strong> <code className="platform-muted">{p.permission_key}</code>
                    <div>
                      <span className={`ux-badge ${badgeFor(p.entitlement_state)}`}>{t(`ea.ent.${p.entitlement_state}` as CopyKey)}</span>{" "}
                      <span className={`ux-badge ${badgeFor(p.functional_state)}`}>{t(`ea.fn.${p.functional_state}` as CopyKey)}</span>{" "}
                      <span className={`ux-badge ${p.effective ? "ux-badge-approved" : p.scoped ? "b-blue" : "b-grey"}`}>
                        {p.effective ? t("ea.effective.yes") : p.scoped ? t("ea.effective.scoped") : t("ea.effective.no")}
                      </span>
                      {p.lapsed ? <span className="ux-badge b-grey"> {t(p.lapsed.kind === "revoked" ? "ea.lapsed.revoked" : "ea.lapsed.expired", { date: fmt(p.lapsed.at) })}</span> : null}
                    </div>
                    {p.decision.reason ? <div className="platform-muted">{p.decision.reason}</div> : null}
                  </div>
                  {canPermissions ? (
                    <select value={choice} aria-label={p.permission_key}
                      onChange={(e) => {
                        const v = e.target.value as Choice
                        setChanges((c) => {
                          const next = { ...c }
                          if (v === currentChoice(p)) delete next[p.permission_key]; else next[p.permission_key] = v
                          return next
                        })
                      }}>
                      <option value="default">{t("ea.perms.choice.default")}</option>
                      <option value="allow" disabled={!canAllow && choice !== "allow"} title={!canAllow ? t("ea.perms.notEntitled") : undefined}>{t("ea.perms.choice.allow")}</option>
                      <option value="deny">{t("ea.perms.choice.deny")}</option>
                    </select>
                  ) : null}
                </div>
              )
            })}
          </div>
        ))}
        {canPermissions ? (pending > 0 ? (
          <div className="access-save-row">
            <span>{t("ea.perms.pending", { count: pending })}</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("ea.perms.reason")} aria-label={t("ea.perms.reason")} />
            <button type="button" className="button-primary" disabled={busy || reason.trim().length < 3} onClick={saveDecisions}>
              {busy ? <LoaderCircle size={14} className="spin" /> : null} {t("ea.perms.save")}
            </button>
          </div>
        ) : null) : <p className="platform-muted">{t("ea.noPower.permissions")}</p>}
      </section>
      {actionError ? <p className="inspection-alert" role="alert">{actionError}</p> : null}
    </div>
  )
}
