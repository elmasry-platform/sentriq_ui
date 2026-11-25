"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronUp, LoaderCircle, UserRound } from "lucide-react"
import { rpc, select } from "@/lib/portal/api"
import { dateLocale, useFriendlyError, usePortalLang, useT, type CopyKey } from "@/lib/portal/i18n"
import { PortalEmpty, PortalError, PortalLoading } from "./states"
import { PlatformMemberAccess } from "./platform-member-access"

/** Capabilities shown in the access editor, mapped to the enabled iam.permission_catalog
 *  keys they control. A decision on a capability writes one audited decision per
 *  catalog key so the backend enforcement and the UI state always agree. */
const CAPABILITIES: { key: string; catalogKeys: string[] }[] = [
  { key: "hse.dashboard", catalogKeys: ["hse.dashboard.read"] },
  { key: "hse.inspections", catalogKeys: ["hse.inspections.read", "hse.inspections.create", "hse.inspections.review"] },
  { key: "hse.forms", catalogKeys: ["hse.forms.read", "hse.forms.manage"] },
  { key: "hse.actions", catalogKeys: ["hse.actions.read", "hse.actions.manage"] },
  { key: "hse.reports", catalogKeys: ["hse.reports.read"] },
]
type PermKey = string

const CAPABILITY_KEYS = CAPABILITIES.map((c) => c.key)
const CATALOG_TO_CAPABILITY: Record<string, string> = Object.fromEntries(
  CAPABILITIES.flatMap((c) => c.catalogKeys.map((k) => [k, c.key])),
)

interface MemberRow { id: string; membershipId: string; role: string; status: string; displayName: string | null; email: string | null }
interface DecisionRow { id: string; membership_id: string; permission_key: string; decision: "allow" | "deny"; reason: string | null; created_at: string }

type Choice = "default" | "allow" | "deny"

/** Per-member access editor: every capability visible with its current state,
 *  segmented Default/Allow/Deny, one audited reason per save. No dropdowns. */
function AccessEditor({ accessToken, tenantId, member, decisions, onSaved }: {
  accessToken: string; tenantId: string; member: MemberRow; decisions: DecisionRow[]; onSaved: () => void
}) {
  const t = useT()
  const fe = useFriendlyError()
  const lang = usePortalLang()
  const current = useMemo(() => {
    const map: Partial<Record<PermKey, DecisionRow>> = {}
    for (const d of decisions) {
      const cap = CATALOG_TO_CAPABILITY[d.permission_key]
      if (d.membership_id === member.membershipId && cap && !map[cap]) {
        map[cap] = d
      }
    }
    return map
  }, [decisions, member.membershipId])
  const [changes, setChanges] = useState<Partial<Record<PermKey, Choice>>>({})
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stateOf = (key: PermKey): Choice => changes[key] ?? (current[key]?.decision ?? "default")
  const dirty = Object.keys(changes).length > 0

  async function save() {
    if (!dirty || reason.trim().length < 3) return
    setBusy(true)
    setError(null)
    try {
      for (const [key, choice] of Object.entries(changes) as [PermKey, Choice][]) {
        const catalogKeys = CAPABILITIES.find((c) => c.key === key)?.catalogKeys ?? [key]
        for (const catalogKey of catalogKeys) {
          if (choice === "default") {
            await rpc("clear_member_permission_decision", {
              p_tenant_id: tenantId, p_membership_id: member.membershipId, p_permission_key: catalogKey, p_reason: reason.trim(),
            }, accessToken)
          } else {
            await rpc("set_member_permission_decision", {
              p_tenant_id: tenantId, p_membership_id: member.membershipId, p_permission_key: catalogKey,
              p_decision: choice, p_scope_kind: "tenant", p_site_id: null, p_org_unit_id: null,
              p_task_kind: null, p_task_id: null,
              p_can_read: choice === "allow", p_can_write: choice === "allow",
              p_ends_at: null, p_exception_kind: null, p_reason: reason.trim(),
            }, accessToken)
          }
        }
      }
      setChanges({})
      setReason("")
      onSaved()
    } catch (e) {
      setError(fe(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="access-editor">
      <div className="access-editor-title">{t("people.accessOf", { email: member.displayName ?? member.email ?? t("people.memberFallback") })}</div>
      {CAPABILITY_KEYS.map((key) => {
        const state = stateOf(key)
        const live = current[key]
        return (
          <div key={key} className="access-row">
            <div className="access-row-name">
              <strong>{t(`perm.${key}` as CopyKey)}</strong>
              <span>{t(`perm.${key}.desc` as CopyKey)}</span>
            </div>
            <div className="seg" role="group" aria-label={t(`perm.${key}` as CopyKey)}>
              {(["default", "allow", "deny"] as Choice[]).map((c) => (
                <button key={c} type="button"
                  className={`seg-option${state === c ? ` seg-on-${c}` : ""}`}
                  aria-pressed={state === c}
                  onClick={() => setChanges((prev) => {
                    const base = current[key]?.decision ?? "default"
                    const next = { ...prev }
                    if (c === base) delete next[key]; else next[key] = c
                    return next
                  })}>
                  {t(`people.seg.${c}` as CopyKey)}{state === c ? " ✓" : ""}
                </button>
              ))}
            </div>
            <div className="access-row-state">
              {state === "default" ? (
                <span className="ux-badge b-grey">{t("people.state.default", { level: t(`level.${member.role}` as CopyKey) })}</span>
              ) : state === "allow" ? (
                <span className="ux-badge b-blue">{t("people.state.allowed", { date: live && changes[key] === undefined ? new Date(live.created_at).toLocaleDateString(dateLocale(lang)) : "—" })}</span>
              ) : (
                <span className="ux-badge b-red">{t("people.state.denied", { date: live && changes[key] === undefined ? new Date(live.created_at).toLocaleDateString(dateLocale(lang)) : "—", reason: live && changes[key] === undefined ? live.reason ?? "" : "" })}</span>
              )}
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
      {error ? <p className="inspection-alert" role="alert">{error}</p> : null}
      <details className="more-options"><summary>{t("more.details")}</summary>
        <p className="access-audit-note">{t("people.accessHint")}</p>
        <p className="access-audit-note">{t("perms.auditNote")}</p>
      </details>
    </div>
  )
}

export function MembersPanel({ accessToken, tenantId, selfUserId, moduleEditor = false }: { accessToken: string; tenantId: string; selfUserId: string; moduleEditor?: boolean }) {
  const t = useT()
  const fe = useFriendlyError()
  const [rows, setRows] = useState<MemberRow[] | null>(null)
  const [everyone, setEveryone] = useState<MemberRow[]>([])
  const [decisions, setDecisions] = useState<DecisionRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const load = useCallback(() => setTick((n) => n + 1), [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let active = true
    setError(null)
    Promise.all([
      select<MemberRow[]>("v_memberships", {
        workspaceId: `eq.${tenantId}`,
        select: "id,membershipId,role,status,displayName,email",
        order: "role.asc",
      }, accessToken),
      rpc<{ rows?: DecisionRow[] }>("company_member_permission_decisions", { p_tenant_id: tenantId }, accessToken),
    ])
      .then(([members, dec]) => {
        if (!active) return
        setEveryone(members)
        setRows(members.filter((m) => m.id !== selfUserId))
        setDecisions(dec.rows ?? [])
      })
      .catch((e) => { if (active) setError(fe(e)) })
    return () => { active = false }
  }, [accessToken, tenantId, tick, selfUserId])

  if (error) return <PortalError message={error} onRetry={load} />
  if (!rows) return <PortalLoading label={t("people.loading")} />
  if (rows.length === 0) return <PortalEmpty title={t("people.empty.title")} hint={t("people.empty.hint")} />

  const summary = (m: MemberRow) => {
    const seen = new Set<string>()
    const mine = decisions.filter((d) => {
      const cap = CATALOG_TO_CAPABILITY[d.permission_key]
      if (d.membership_id !== m.membershipId || !cap || seen.has(cap)) return false
      seen.add(cap)
      return true
    })
    const allowed = mine.filter((d) => d.decision === "allow").length
    const denied = mine.filter((d) => d.decision === "deny").length
    return { allowed, denied, rest: CAPABILITY_KEYS.length - allowed - denied }
  }

  return (
    <div className="panel platform-panel">
      <div className="panel-header">
        <div>
          <h2>{t("people.members")}</h2>
          <p>{t("people.count", { count: rows.length })}</p>
        </div>
      </div>
      <table className="data-table">
        <thead>
          <tr><th>{t("people.member")}</th><th>{t("people.status")}</th><th>{t("people.accessSummary")}</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const s = summary(m)
            const open = openId === m.membershipId
            return (
              <Fragment key={m.membershipId}>
                <tr>
                  <td className="cell-wrap" data-label={t("people.member")}>
                    <div className="platform-person">
                      <span className="avatar" aria-hidden="true"><UserRound size={14} /></span>
                      <strong className="platform-cell-strong">{m.displayName ?? m.email ?? t("people.memberFallback")}</strong>
                    </div>
                    <div className="platform-muted">{t(`level.${m.role}` as CopyKey)}</div>
                  </td>
                  <td data-label={t("people.status")}><span className={`ux-badge platform-capitalize ${m.status === "active" ? "ux-badge-approved" : "ux-badge-returned"}`}>{t(`status.${m.status}` as CopyKey)}</span></td>
                  <td data-label={t("people.accessSummary")}>
                    {s.allowed === 0 && s.denied === 0 ? <span className="ux-badge b-grey">{t("people.summary.default", { count: s.rest })}</span> : null}{" "}
                    {s.allowed > 0 ? <span className="ux-badge b-blue">{t("people.summary.allowed", { count: s.allowed })}</span> : null}{" "}
                    {s.denied > 0 ? <span className="ux-badge b-red">{t("people.summary.denied", { count: s.denied })}</span> : null}
                  </td>
                  <td>
                    <button type="button" className="button-outline" onClick={() => setOpenId(open ? null : m.membershipId)} aria-expanded={open}>
                      {open ? t("people.hideAccess") : t("people.viewAccess")} {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  </td>
                </tr>
                {open ? (
                  <tr className="access-editor-row">
                    <td colSpan={4}>
                      {moduleEditor ? (
                        <PlatformMemberAccess accessToken={accessToken} tenantId={tenantId}
                          member={{ membershipId: m.membershipId, role: m.role, status: m.status, displayName: m.displayName, email: m.email }}
                          company={{ selfUserId, selfMembershipId: everyone.find((x) => x.id === selfUserId)?.membershipId ?? null, people: everyone.map((x) => ({ userId: x.id, role: x.role, status: x.status })) }} />
                      ) : (
                        <AccessEditor accessToken={accessToken} tenantId={tenantId} member={m} decisions={decisions} onSaved={load} />
                      )}
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
