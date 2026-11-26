"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { LoaderCircle, PauseCircle, PlayCircle, UserRound } from "lucide-react"
import { rpc, select, ApiError } from "@/lib/portal/api"
import { useFriendlyError, useT, type CopyKey } from "@/lib/portal/i18n"
import { Dialog } from "@/components/sentriq/dialog"
import type { CompanyRow } from "./companies"
import { PortalEmpty, PortalError, PortalLoading } from "./states"
import { PlatformMemberAccess } from "./platform-member-access"
import { latestRestore, restoreLines, type RestoreRow } from "@/lib/portal/restore-report"

interface MemberRow { id: string; user_id: string; member_role: string; status: string; display_name: string | null; email: string | null }

const LEVEL_KEY: Record<string, CopyKey> = {
  company_superadmin: "level.company_superadmin",
  company_admin: "level.company_admin",
  employee: "level.employee",
}

/** Operator page (Owner, Sub-owner): choose a company, find a person, change their access.
 *  Company-wide controls live on the Companies page. Which actions appear follows the
 *  caller's platform powers; the server still enforces every one. */
export function MemberAccessPage({ accessToken, canLifecycle = true, canPermissions = true, canEntitlements = true, ownCompany }: {
  accessToken: string; canLifecycle?: boolean; canPermissions?: boolean; canEntitlements?: boolean
  /** Superadmin mode: one fixed company, company RPCs, own row excluded and locked. */
  ownCompany?: { tenantId: string; selfUserId: string }
}) {
  const t = useT()
  const fe = useFriendlyError()
  const [companies, setCompanies] = useState<CompanyRow[] | null>(null)
  const [companyId, setCompanyId] = useState("")
  const [members, setMembers] = useState<MemberRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [level, setLevel] = useState("")
  const [memberId, setMemberId] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [pending, setPending] = useState<{ member: MemberRow; status: "active" | "suspended" } | null>(null)
  const [reason, setReason] = useState("")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [restored, setRestored] = useState<{ name: string; row: RestoreRow | null; error: string | null } | null>(null)
  const reload = useCallback(() => setTick((v) => v + 1), [])

  const [everyone, setEveryone] = useState<{ id: string; membershipId: string; role: string; status: string }[]>([])

  useEffect(() => {
    if (ownCompany) { setCompanies([{ id: ownCompany.tenantId, name: "", industry_label: null, status: "active", created_at: "" }]); setCompanyId(ownCompany.tenantId); return }
    let active = true
    rpc<{ rows: CompanyRow[] }>("platform_list_companies", { p_limit: 100 }, accessToken)
      .then((res) => {
        if (!active) return
        const rows = res.rows ?? []
        setCompanies(rows)
        const wanted = new URLSearchParams(window.location.search).get("company")
        const first = rows.find((c) => c.id === wanted) ?? rows[0]
        setCompanyId((cur) => cur || first?.id || "")
      })
      .catch((e) => { if (active) { setCompanies([]); setError(e instanceof ApiError && e.status === 403 ? t("companies.denied.title") : fe(e)) } })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  useEffect(() => {
    if (!companyId) return
    let active = true
    setMembers(null); setError(null); setMemberId(null)
    const load: Promise<MemberRow[]> = ownCompany
      ? select<{ id: string; membershipId: string; role: string; status: string; displayName: string | null; email: string | null }[]>("v_memberships", {
          workspaceId: `eq.${ownCompany.tenantId}`, select: "id,membershipId,role,status,displayName,email", order: "role.asc",
        }, accessToken).then((rows) => {
          setEveryone(rows)
          return rows.filter((m) => m.id !== ownCompany.selfUserId)
            .map((m) => ({ id: m.membershipId, user_id: m.id, member_role: m.role, status: m.status, display_name: m.displayName, email: m.email }))
        })
      : rpc<{ rows?: MemberRow[] } | MemberRow[]>("platform_read_company", { p_tenant_id: companyId, p_resource: "iam.memberships", p_limit: 100 }, accessToken)
          .then((res) => (Array.isArray(res) ? res : res.rows ?? []))
    load
      .then((rows) => { if (active) setMembers(rows) })
      .catch((e) => { if (active) { setMembers([]); setError(fe(e)) } })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, companyId, tick])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (members ?? []).filter((m) => (!level || m.member_role === level) && (!q || `${m.display_name ?? ""} ${m.email ?? ""}`.toLowerCase().includes(q)))
  }, [members, query, level])
  const selected = (members ?? []).find((m) => m.id === memberId) ?? null
  const name = (m: MemberRow) => m.display_name ?? m.email ?? t("people.memberFallback")

  async function confirmStatus() {
    if (!pending || reason.trim().length < 3) return
    setBusy(true)
    try {
      await rpc("platform_set_membership_status", { p_tenant_id: companyId, p_membership_id: pending.member.id, p_status: pending.status, p_reason: reason.trim() }, accessToken)
      const reactivated = pending.status === "active" ? pending.member : null
      setPending(null); setReason(""); setSaveError(null); reload()
      // Operators see what the reactivation restored. Company managers do not get the report.
      if (reactivated && !ownCompany) {
        const who = name(reactivated)
        try {
          const body = await rpc<unknown>("membership_restore_report", { p_tenant_id: companyId, p_membership_id: reactivated.id }, accessToken)
          setRestored({ name: who, row: latestRestore(body), error: null })
        } catch (e) { setRestored({ name: who, row: null, error: fe(e) }) }
      }
    } catch (e) { setSaveError(fe(e)) } finally { setBusy(false) }
  }

  if (!companies) return <PortalLoading label={t("companies.loading")} />
  if (companies.length === 0) return error ? <PortalError message={error} onRetry={() => window.location.reload()} /> : <PortalEmpty titleKey="companies.empty.title" hintKey="companies.empty.hint" />

  return (
    <div className="access-page" data-testid="member-access-page">
      <aside className="panel platform-panel access-people" aria-label={t("access.members")}>
        {ownCompany ? null : (
        <label>{t("access.company")}
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} aria-label={t("access.company")}>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>)}
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("access.search")} aria-label={t("access.search")} />
        <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label={t("detail.level")}>
          <option value="">{t("access.role.all")}</option>
          {Object.keys(LEVEL_KEY).map((k) => <option key={k} value={k}>{t(LEVEL_KEY[k])}</option>)}
        </select>
        {error ? <PortalError message={error} onRetry={reload} /> : !members ? <PortalLoading label={t("detail.loading")} />
          : shown.length === 0 ? <p className="platform-muted">{t("access.members.empty")}</p> : (
          <div className="access-person-list">
            {shown.map((m) => (
              <button key={m.id} type="button" className="access-person" aria-current={m.id === memberId} onClick={() => setMemberId(m.id)}>
                <span className="avatar" aria-hidden="true"><UserRound size={14} /></span>
                <span>
                  <strong>{name(m)}</strong>
                  <small>{LEVEL_KEY[m.member_role] ? t(LEVEL_KEY[m.member_role]) : m.member_role} · {t(`status.${m.status}` as CopyKey)}</small>
                </span>
              </button>
            ))}
          </div>
        )}
      </aside>
      <section className="panel platform-panel" aria-live="polite">
        {!selected ? <PortalEmpty titleKey="access.pickMember" hintKey="access.subtitle" /> : (
          <>
            <div className="panel-header">
              <div><h2>{name(selected)}</h2><p>{selected.email ?? ""}</p></div>
              {ownCompany ? null : canLifecycle ? (
                busy ? <LoaderCircle size={15} className="spin platform-muted" /> : selected.status === "active" ? (
                  <button type="button" className="button-outline platform-warn" onClick={() => { setPending({ member: selected, status: "suspended" }); setReason(""); setSaveError(null) }}><PauseCircle size={13} /> {t("detail.suspendMember")}</button>
                ) : selected.status === "suspended" ? (
                  <button type="button" className="button-outline platform-ok" onClick={() => { setPending({ member: selected, status: "active" }); setReason(""); setSaveError(null) }}><PlayCircle size={13} /> {t("detail.reactivateMember")}</button>
                ) : null
              ) : <span className="platform-muted">{t("detail.managedByOwner")}</span>}
            </div>
            <PlatformMemberAccess key={`${companyId}:${selected.id}`} accessToken={accessToken} tenantId={companyId} canPermissions={canPermissions} canEntitlements={canEntitlements}
              company={ownCompany ? { selfUserId: ownCompany.selfUserId, selfMembershipId: everyone.find((x) => x.id === ownCompany.selfUserId)?.membershipId ?? null, people: everyone.map((x) => ({ userId: x.id, role: x.role, status: x.status })) } : undefined}
              member={{ membershipId: selected.id, role: selected.member_role, status: selected.status, displayName: selected.display_name, email: selected.email }} />
          </>
        )}
      </section>
      {restored ? (
        <Dialog title={t("restore.title")} closeLabel={t("restore.close")} onClose={() => setRestored(null)}>
          <p className="ux-dialog-hint"><bdi>{restored.name}</bdi></p>
          {restored.error ? <p className="inspection-alert" role="alert">{t("restore.unavailable")}</p>
            : !restored.row ? <p>{t("restore.empty")}</p>
            : restored.row.mode === "clean_slate" || restoreLines(restored.row.outcome ?? {}).length === 0 ? <p>{t("restore.none")}</p>
            : <ul>{restoreLines(restored.row.outcome ?? {}).map((l) => <li key={l.key}>{t(l.key, { count: l.count })}</li>)}</ul>}
          <p className="platform-muted">{t("restore.note")}</p>
          <div className="inspection-modal-actions"><button type="button" className="button-primary" onClick={() => setRestored(null)}>{t("restore.close")}</button></div>
        </Dialog>
      ) : null}
      {pending ? (
        <Dialog title={pending.status === "suspended" ? t("detail.suspend.title", { name: name(pending.member) }) : t("detail.reactivate.title", { name: name(pending.member) })} closeLabel={t("companies.cancel")} onClose={() => setPending(null)}>
          <p className="ux-dialog-hint">{pending.status === "suspended" ? t("detail.suspend.hint") : t("detail.reactivate.hint")}</p>
          <label>{t("companies.reason")}<textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder={t("detail.reason.placeholder")} data-autofocus /></label>
          {saveError ? <p className="inspection-alert" role="alert">{saveError}</p> : null}
          <div className="inspection-modal-actions">
            <button type="button" className="button-outline" onClick={() => setPending(null)}>{t("companies.cancel")}</button>
            <button type="button" className="button-primary" onClick={confirmStatus} disabled={reason.trim().length < 3 || busy}>
              {pending.status === "suspended" ? t("detail.suspendMember") : t("detail.reactivateMember")}
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  )
}
