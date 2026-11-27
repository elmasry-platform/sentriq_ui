"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Lock, LoaderCircle, MoreHorizontal } from "lucide-react"
import { rpc } from "@/lib/portal/api"
import { dateLocale, tryCopy, useFriendlyError, usePortalLang, useT, type CopyKey } from "@/lib/portal/i18n"
import { permissionLabel } from "@/lib/portal/perm-label"
import { PortalError, PortalLoading } from "./states"
import { ROLE_PRESETS, isOperational, presetKeys, type RolePreset } from "@/lib/portal/presets"

/** Everything below is rendered from the server's effective-access calculation.
 *  No module, feature or permission key is named here: groups, labels and
 *  choices come from the catalog the server returns. */
interface ModuleState { module_key: string; company_entitled: boolean; state: string }
interface FeatureState { feature_key: string; module_key: string; state: string }
interface GrantRow {
  grant_id: string; module_key: string | null; feature_key: string | null; can_use: boolean; can_delegate: boolean
  delegated_by?: string | null
  starts_at: string; expires_at: string | null; permanent: boolean; reason: string; status: string
  delegated_from_grant_id: string | null; revoke_reason: string | null
}
interface PermissionRow {
  permission_key: string; module_key: string; feature_key: string | null
  entitlement_state: string; functional_state: string; effective: boolean; scoped: boolean
  decision: { deny_id: string | null; allow_id: string | null; reason: string | null; ends_at: string | null; granted_by?: string | null }
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

function currentChoice(p: PermissionRow): Choice {
  if (p.decision.deny_id) return "deny"
  if (p.decision.allow_id) return "allow"
  return "default"
}

/** Platform-operator view of one member's access. Three separate layers: what the
 *  company subscribes to, personal entitlement exceptions or restrictions, and
 *  functional permissions (Default, Allow, Deny). */
/** Company mode (Superadmin): same editor, company rules. Decisions go through the
 *  company RPCs, personal exceptions cannot be created (only delegated from an
 *  entitlement the signed-in person holds), and a Deny placed by another
 *  Superadmin is locked: only its setter, a Subowner or the Owner can change it. */
export interface CompanyContext {
  selfUserId: string
  selfMembershipId: string | null
  /** Active members of the company, by user id, so the setter of a Deny can be classified. */
  people: { userId: string; role: string; status: string }[]
}

export function PlatformMemberAccess({ accessToken, tenantId, member, canPermissions: canPermissionsProp = true, canEntitlements = true, company, readOnly = false }: {
  accessToken: string; tenantId: string; member: PlatformMember; canPermissions?: boolean; canEntitlements?: boolean; company?: CompanyContext; readOnly?: boolean
}) {
  const canPermissions = canPermissionsProp && !readOnly
  const t = useT()
  const fe = useFriendlyError()
  const lang = usePortalLang()
  const [data, setData] = useState<EffectiveAccess | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((n) => n + 1), [])

  const [changes, setChanges] = useState<Record<string, Choice>>({})
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const [permQuery, setPermQuery] = useState("")
  const [permFilter, setPermFilter] = useState<"all" | "allowed" | "blocked" | "changed">("all")
  const [showKeys, setShowKeys] = useState(false)

  const [addMode, setAddMode] = useState<"exception" | "restriction">("exception")
  const [addScope, setAddScope] = useState<"module" | "feature">("feature")
  const [addKey, setAddKey] = useState("")
  const [addDelegate, setAddDelegate] = useState(false)
  const [addExpires, setAddExpires] = useState("")
  const [addReason, setAddReason] = useState("")
  const [mine, setMine] = useState<GrantRow[]>([])
  const [delSource, setDelSource] = useState("")
  const [delExpires, setDelExpires] = useState("")
  const [delReason, setDelReason] = useState("")
  const [revokeId, setRevokeId] = useState<string | null>(null)
  const [revokeReason, setRevokeReason] = useState("")

  useEffect(() => {
    let active = true
    setError(null)
    rpc<EffectiveAccess>("member_effective_access", { p_tenant_id: tenantId, p_membership_id: member.membershipId }, accessToken)
      .then((r) => { if (active) { setData(r); setChanges({}) } })
      .catch((e) => { if (active) setError(fe(e)) })
    if (company?.selfMembershipId) {
      rpc<EffectiveAccess>("member_effective_access", { p_tenant_id: tenantId, p_membership_id: company.selfMembershipId }, accessToken)
        .then((r) => { if (active) setMine((r.entitlement_grants ?? []).filter((g) => g.status === "live" && g.can_use && g.can_delegate && !g.delegated_from_grant_id)) })
        .catch(() => { if (active) setMine([]) })
    }
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, tenantId, member.membershipId, tick])

  // A Deny is locked for this person when someone else placed it and that someone is
  // a Superadmin, no longer active, or not in this company. The server enforces the same
  // rule; this is a hint inferred from the setter's membership in the loaded member list,
  // and it fails closed: a Deny with an unknown setter is shown as locked.
  const denyLocked = (p: PermissionRow): boolean => {
    if (!company || !p.decision.deny_id) return false
    const by = p.decision.granted_by
    if (!by) return true
    if (by === company.selfUserId) return false
    const setter = company.people.find((x) => x.userId === by)
    return !(setter && setter.status === "active" && setter.role !== "company_superadmin")
  }

  // An Allow placed by an operator is protected: a company Superadmin cannot change it, so presets skip it.
  const allowProtected = (p: PermissionRow): boolean => {
    if (!company || !p.decision.allow_id) return false
    const by = p.decision.granted_by
    if (!by) return true
    if (by === company.selfUserId) return false
    const setter = company.people.find((x) => x.userId === by)
    return !(setter && setter.status === "active" && setter.role === "company_superadmin")
  }

  const groups = useMemo(() => {
    const by = new Map<string, PermissionRow[]>()
    for (const p of data?.permissions ?? []) by.set(p.module_key, [...(by.get(p.module_key) ?? []), p])
    return [...by.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [data])

  if (error) return <PortalError message={error} onRetry={reload} />
  if (!data) return <PortalLoading label={t("people.loading")} />

  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(dateLocale(lang)) : "")
  const permLabel = (p: PermissionRow, _moduleKey: string) => permissionLabel(p.permission_key, (ck) => tryCopy(lang, ck))
  const sum = (() => {
    const all = data.permissions
    const blocked = all.filter((p) => p.functional_state === "deny" || p.entitlement_state === "restricted").length
    const allowed = all.filter((p) => p.effective).length
    const rest = all.filter((p) => !p.effective && !(p.functional_state === "deny" || p.entitlement_state === "restricted"))
    const notGranted = rest.filter((p) => p.entitlement_state === "company" || p.entitlement_state === "personal_exception").length
    return { total: all.length, allowed, blocked, notGranted, notInPlan: rest.length - notGranted }
  })()
  const q = permQuery.trim().toLowerCase()
  const visibleGroups = groups
    .map(([k, allRows]) => {
      const rows = allRows.filter((p) => {
        if (permFilter === "allowed" && !p.effective) return false
        if (permFilter === "blocked" && !(p.functional_state === "deny" || p.entitlement_state === "restricted")) return false
        if (permFilter === "changed" && changes[p.permission_key] === undefined) return false
        if (!q) return true
        return permLabel(p, k).toLowerCase().includes(q) || p.permission_key.toLowerCase().includes(q)
      })
      return [k, rows, allRows] as [string, PermissionRow[], PermissionRow[]]
    })
    .filter(([, rows]) => rows.length > 0)
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
        if (company) {
          if (choice === "default") {
            await rpc("clear_member_permission_decision", {
              p_tenant_id: tenantId, p_membership_id: member.membershipId, p_permission_key: key, p_reason: reason.trim(),
            }, accessToken)
          } else {
            await rpc("set_member_permission_decision", {
              p_tenant_id: tenantId, p_membership_id: member.membershipId, p_permission_key: key,
              p_decision: choice, p_scope_kind: "tenant", p_site_id: null, p_org_unit_id: null, p_task_kind: null, p_task_id: null,
              p_can_read: choice === "allow", p_can_write: choice === "allow", p_ends_at: null, p_exception_kind: null, p_reason: reason.trim(),
            }, accessToken)
          }
        } else {
          await rpc("platform_set_member_decision", {
            p_tenant_id: tenantId, p_membership_id: member.membershipId, p_permission_key: key, p_choice: choice, p_reason: reason.trim(),
          }, accessToken)
        }
        saved += 1
      }
      setReason("")
    } catch (e) {
      setActionError(`${fe(e)} (${saved}/${entries.length})`)
    } finally {
      setBusy(false); reload()
    }
  }

  const applyPreset = (preset: RolePreset) => {
    const wanted = new Set(presetKeys(preset.id, data.permissions))
    const next: Record<string, Choice> = {}
    for (const p of data.permissions) {
      if (denyLocked(p) || allowProtected(p) || p.decision.deny_id) continue
      const cur = currentChoice(p)
      const canAllow = p.entitlement_state === "company" || p.entitlement_state === "personal_exception"
      const target: Choice | null = wanted.has(p.permission_key) ? (canAllow ? "allow" : null) : (isOperational(p) && cur === "allow" ? "default" : null)
      if (target && target !== cur) next[p.permission_key] = target
    }
    setChanges(next)
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
    await rpc(company ? "revoke_delegated_entitlement" : "platform_revoke_member_entitlement", { p_grant_id: revokeId, p_reason: revokeReason.trim() }, accessToken)
  }, () => { setRevokeId(null); setRevokeReason("") })

  const delegate = () => run(async () => {
    await rpc("delegate_member_entitlement", {
      p_tenant_id: tenantId, p_source_grant_id: delSource, p_target_membership_id: member.membershipId,
      p_reason: delReason.trim(), p_expires_at: delExpires ? new Date(`${delExpires}T23:59:59Z`).toISOString() : null,
    }, accessToken)
  }, () => { setDelSource(""); setDelExpires(""); setDelReason("") })

  if (readOnly) {
    return (
      <div className="access-editor" data-testid="effective-access">
        <p className="access-audit-note">{t("ea.level")}: <strong>{t(`level.${data.membership.role}` as CopyKey)}</strong></p>
        <p className="access-readonly-note" role="note" data-testid="readonly-note"><Lock size={14} aria-hidden="true" /> {t("ea.managedByOperator")}</p>
      </div>
    )
  }

  return (
    <div className="access-editor" data-testid="effective-access">
      <h3>{t("ea.title", { name: member.displayName ?? member.email ?? "" })}</h3>
      <p className="access-audit-note">{t("ea.level")}: <strong>{t(`level.${data.membership.role}` as CopyKey)}</strong></p>
      {readOnly ? <p className="access-readonly-note" role="note" data-testid="readonly-note"><Lock size={14} aria-hidden="true" /> {t("ea.managedByOperator")}</p> : null}

      <section aria-label={t("ea.summary.title")} className="access-summary" data-testid="access-summary">
        <h4>{t("ea.summary.title")}</h4>
        <p><strong>{t("ea.summary.line", { allowed: sum.allowed, total: sum.total, blocked: sum.blocked, notGranted: sum.notGranted, notInPlan: sum.notInPlan })}</strong></p>
        <details className="more-options"><summary>{t("ea.help.title")}</summary>
          <p className="access-audit-note">{t("ea.refresh")}</p>
          <p className="access-audit-note">{t("ea.summary.hint")}</p>
          <p className="access-audit-note">{t("ea.perms.subtitle")}</p>
          <p className="access-audit-note">{t("preset.note")}</p>
          <p className="access-audit-note">{t("ea.personal.subtitle")}</p>
        </details>
      </section>

      <section aria-label={t("ea.perms.title")}>
        <h4>{t("ea.perms.title")}</h4>
        {canPermissions ? (
          <div className="access-presets" role="group" aria-label={t("preset.title")}>
            <strong>{t("preset.title")}</strong>
            {ROLE_PRESETS.map((pr) => (
              <button key={pr.id} type="button" className="button-outline" title={t(pr.hintKey)} data-preset={pr.id} onClick={() => applyPreset(pr)}>{t(pr.labelKey)}</button>
            ))}
          </div>
        ) : null}
        <div className="access-toolbar">
          <input type="search" value={permQuery} onChange={(e) => setPermQuery(e.target.value)} placeholder={t("ea.perms.search")} aria-label={t("ea.perms.search")} />
          <div className="seg" role="group" aria-label={t("ea.perms.title")}>
            {(["all", "allowed", "blocked", "changed"] as const).map((f) => (
              <button key={f} type="button" aria-pressed={permFilter === f} className={`seg-option${permFilter === f ? " seg-on-default" : ""}`} onClick={() => setPermFilter(f)}>{t(`ea.perms.filter.${f}` as CopyKey)}</button>
            ))}
          </div>
          <details className="row-menu">
            <summary aria-label={t("more.options")} title={t("more.options")}><MoreHorizontal size={16} aria-hidden="true" /></summary>
            <div className="row-menu-list">
              <label className="access-keys-toggle"><input type="checkbox" checked={showKeys} onChange={(e) => setShowKeys(e.target.checked)} /> {t("ea.perms.showKeys")}</label>
              <button type="button" className="button-outline" onClick={() => setOpenGroups(Object.fromEntries(groups.map(([k]) => [k, true])))}>{t("ea.perms.expandAll")}</button>
              <button type="button" className="button-outline" onClick={() => setOpenGroups({})}>{t("ea.perms.collapseAll")}</button>
            </div>
          </details>
        </div>
        {visibleGroups.length === 0 ? <p className="platform-muted">{t("ea.perms.noMatch")}</p> : null}
        {visibleGroups.map(([moduleKey, rows, allRows]) => {
          const searching = permQuery.trim() !== "" || permFilter !== "all"
          const isOpen = searching || openGroups[moduleKey] === true
          const bodyId = `ea-group-${moduleKey}`
          const denied = allRows.filter((p) => p.functional_state === "deny").length
          const restricted = allRows.filter((p) => p.entitlement_state === "restricted").length
          const exceptions = allRows.filter((p) => p.entitlement_state === "personal_exception").length
          const unsaved = allRows.filter((p) => changes[p.permission_key] !== undefined).length
          return (
          <div key={moduleKey} className="access-group">
            <h5 className="access-group-head">
              <button type="button" className="access-group-toggle" aria-expanded={isOpen} aria-controls={bodyId}
                onClick={() => setOpenGroups((g) => ({ ...g, [moduleKey]: !(searching || g[moduleKey] === true) }))}>
                {isOpen ? <ChevronDown size={16} aria-hidden="true" className="access-chevron" /> : <ChevronRight size={16} aria-hidden="true" className="access-chevron" />}
                <strong>{tryCopy(lang, `module.${moduleKey}`) ?? moduleKey}</strong>
                {showKeys ? <code>{moduleKey}</code> : null}
                <span className="access-group-summary">
                  <span className="ux-badge b-grey">{t("ea.group.count", { count: allRows.length })}</span>
                  {denied > 0 ? <span className="ux-badge b-red">{t("ea.group.denied", { count: denied })}</span> : null}
                  {restricted > 0 ? <span className="ux-badge b-red">{t("ea.group.restricted", { count: restricted })}</span> : null}
                  {exceptions > 0 ? <span className="ux-badge b-blue">{t("ea.group.exceptions", { count: exceptions })}</span> : null}
                  {unsaved > 0 ? <span className="ux-badge b-blue">{t("ea.group.unsaved", { count: unsaved })}</span> : null}
                </span>
              </button>
            </h5>
            <div id={bodyId} role="region" aria-label={tryCopy(lang, `module.${moduleKey}`) ?? moduleKey} hidden={!isOpen}>
            {rows.map((p) => {
              const choice = changes[p.permission_key] ?? currentChoice(p)
              const canAllow = p.entitlement_state === "company" || p.entitlement_state === "personal_exception"
              const locked = denyLocked(p)
              const opts: { v: Choice; label: string; disabled: boolean }[] = [
                { v: "default", label: t("ea.perms.choice.default"), disabled: locked },
                { v: "allow", label: t("ea.perms.choice.allow"), disabled: locked || (!canAllow && choice !== "allow") },
                { v: "deny", label: t("ea.perms.choice.deny"), disabled: locked },
              ]
              const setChoice = (v: Choice) => setChanges((c) => {
                const next = { ...c }
                if (v === currentChoice(p)) delete next[p.permission_key]; else next[p.permission_key] = v
                return next
              })
              return (
                <div key={p.permission_key} className="access-row" data-permission={p.permission_key}>
                  <div>
                    <strong>{permLabel(p, moduleKey)}</strong>{showKeys ? <> <code className="platform-muted">{p.permission_key}</code></> : null}
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
                    <div>
                      <div className="seg" role="radiogroup" aria-label={permLabel(p, moduleKey)} data-permission-choice={p.permission_key}>
                        {opts.map((o) => (
                          <button key={o.v} type="button" role="radio" aria-checked={choice === o.v} disabled={o.disabled}
                            title={o.v === "allow" && !canAllow ? t("ea.perms.notEntitled") : undefined}
                            className={`seg-option${choice === o.v ? ` seg-on-${o.v}` : ""}`} onClick={() => setChoice(o.v)}>{o.label}</button>
                        ))}
                      </div>
                      {locked ? <div className="platform-muted" role="note">{t("ea.lock.deny")}</div> : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
            </div>
          </div>
          )
        })}
        {canPermissions ? (pending > 0 ? (
          <div className="access-review" data-testid="access-review">
            <h5>{t("ea.perms.review.title")}</h5>
            <ul>
              {Object.entries(changes).map(([key, to]) => {
                const p = data.permissions.find((x) => x.permission_key === key)
                return p ? <li key={key}>{t("ea.perms.review.line", { label: permLabel(p, p.module_key), from: t(`ea.perms.choice.${currentChoice(p)}` as CopyKey), to: t(`ea.perms.choice.${to}` as CopyKey) })}</li> : null
              })}
            </ul>
            <div className="access-save-row">
              <span>{t("ea.perms.pending", { count: pending })}</span>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("ea.perms.reason")} aria-label={t("ea.perms.reason")} />
              <button type="button" className="button-outline" disabled={busy} onClick={() => setChanges({})}>{t("ea.perms.discard")}</button>
              <button type="button" className="button-primary" disabled={busy || reason.trim().length < 3} onClick={saveDecisions}>
                {busy ? <LoaderCircle size={14} className="spin" /> : null} {t("ea.perms.save")}
              </button>
            </div>
          </div>
        ) : null) : readOnly ? null : <p className="platform-muted">{t("ea.noPower.permissions")}</p>}
      </section>
      <details className="platform-fold" data-testid="access-advanced">
        <summary>{t("ea.advanced.title")}</summary>
      <section aria-label={t("ea.company.title")}>
        <h4>{t("ea.company.title")}</h4>
        <table className="data-table">
          <thead><tr><th>{t("ea.module")}</th><th>{t("ea.company.entitled")}</th><th>{t("ea.ent.company")}</th></tr></thead>
          <tbody>
            {data.modules.map((m) => (
              <tr key={m.module_key}>
                <td><code>{tryCopy(lang, `module.${m.module_key}`) ?? m.module_key}</code></td>
                <td>{m.company_entitled ? t("ea.company.entitled") : t("ea.company.notEntitled")}</td>
                <td><span className={`ux-badge ${badgeFor(m.state)}`}>{t(`ea.ent.${m.state}` as CopyKey)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-label={t("ea.personal.title")}>
        <h4>{t("ea.personal.title")}</h4>
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
                  <td style={{ overflowWrap: "anywhere", paddingInlineEnd: 12 }}>{g.status === "revoked" && g.revoke_reason ? `${g.reason} / ${g.revoke_reason}` : g.reason}</td>
                  <td>
                    {(!readOnly && (company ? (g.status === "live" && !!g.delegated_from_grant_id && g.delegated_by === company.selfUserId) : (canEntitlements && g.status === "live" && !g.delegated_from_grant_id))) ? (
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
        {readOnly ? <p className="platform-muted" role="note">{t("ea.managedByOperator")}</p> : company ? (
          <div role="group" aria-label={t("ea.delegate.title")}>
            <p className="access-audit-note">{t("ea.company.noException")}</p>
            {member.status !== "active" ? <p className="platform-muted">{t("ea.delegate.inactive")}</p> : mine.length === 0 ? <p className="platform-muted">{t("ea.delegate.none")}</p> : (
              <div className="access-save-row">
                <strong>{t("ea.delegate.title")}</strong>
                <select value={delSource} onChange={(e) => setDelSource(e.target.value)} aria-label={t("ea.delegate.source")}>
                  <option value="">—</option>
                  {mine.map((g) => <option key={g.grant_id} value={g.grant_id}>{g.feature_key ?? g.module_key}</option>)}
                </select>
                <label>{t("ea.add.expires")} <input type="date" min={new Date().toISOString().slice(0, 10)} value={delExpires} onChange={(e) => setDelExpires(e.target.value)} /></label>
                <input value={delReason} onChange={(e) => setDelReason(e.target.value)} placeholder={t("ea.personal.reason")} aria-label={t("ea.personal.reason")} />
                <button type="button" className="button-primary" disabled={busy || !delSource || delReason.trim().length < 3} onClick={delegate}>
                  {busy ? <LoaderCircle size={14} className="spin" /> : null} {t("ea.delegate.submit")}
                </button>
              </div>
            )}
          </div>
        ) : canEntitlements ? (
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
            <label>{t("ea.add.expires")} <input type="date" min={new Date().toISOString().slice(0, 10)} value={addExpires} onChange={(e) => setAddExpires(e.target.value)} /></label>
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

      </details>
      {actionError ? <p className="inspection-alert" role="alert">{actionError}</p> : null}
    </div>
  )
}
