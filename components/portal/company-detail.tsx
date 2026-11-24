"use client"

import { useCallback, useEffect, useState } from "react"
import { LoaderCircle, PauseCircle, PlayCircle, UserRound, X } from "lucide-react"
import { rpc } from "@/lib/portal/api"
import { useFriendlyError, useT, type CopyKey } from "@/lib/portal/i18n"
import { Dialog } from "@/components/sentriq/dialog"
import type { CompanyRow } from "./companies"
import { PortalEmpty, PortalError, PortalLoading } from "./states"

interface CompanyMemberRow { id: string; user_id: string; member_role: string; status: string; display_name: string | null; email: string | null }

const LEVEL_KEY: Record<string, CopyKey> = {
  company_superadmin: "level.company_superadmin",
  company_admin: "level.company_admin",
  employee: "level.employee",
}

/** Platform view into one company: its people and their access lifecycle. */
export function CompanyDetail({ accessToken, company, canLifecycle = true, onClose }: { accessToken: string; company: CompanyRow; canLifecycle?: boolean; onClose: () => void }) {
  const t = useT()
  const fe = useFriendlyError()
  const [rows, setRows] = useState<CompanyMemberRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [pending, setPending] = useState<{ member: CompanyMemberRow; status: "active" | "suspended" } | null>(null)
  const [reason, setReason] = useState("")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => setTick((v) => v + 1), [])

  useEffect(() => {
    let active = true
    setRows(null)
    setError(null)
    rpc<{ rows?: CompanyMemberRow[] } | CompanyMemberRow[]>("platform_read_company", { p_tenant_id: company.id, p_resource: "iam.memberships", p_limit: 100 }, accessToken)
      .then((res) => { if (active) setRows(Array.isArray(res) ? res : res.rows ?? []) })
      .catch((e) => { if (active) setError(fe(e)) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, company.id, tick])

  async function confirmStatus() {
    if (!pending || reason.trim().length < 3) return
    const { member, status } = pending
    setBusyId(member.id)
    try {
      await rpc("platform_set_membership_status", { p_tenant_id: company.id, p_membership_id: member.id, p_status: status, p_reason: reason.trim() }, accessToken)
      setPending(null)
      setReason("")
      setSaveError(null)
      load()
    } catch (e) {
      setSaveError(fe(e))
    } finally {
      setBusyId(null)
    }
  }

  const memberName = (m: CompanyMemberRow) => m.display_name ?? m.email ?? t("people.memberFallback")

  return (
    <section className="panel platform-panel">
      <div className="panel-header">
        <div>
          <h2>{t("detail.people", { name: company.name })}</h2>
          <p>{t("detail.subtitle")}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={t("detail.close")} className="button-outline platform-icon-button"><X size={15} /></button>
      </div>
      {error ? <PortalError message={error} onRetry={load} />
        : !rows ? <PortalLoading label={t("detail.loading")} />
        : rows.length === 0 ? <PortalEmpty titleKey="detail.empty.title" hintKey="detail.empty.hint" />
        : (
          <table className="data-table">
            <thead>
              <tr><th>{t("detail.member")}</th><th>{t("detail.level")}</th><th>{t("detail.status")}</th><th>{t("detail.actions")}</th></tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="platform-person">
                      <span className="avatar" aria-hidden="true"><UserRound size={14} /></span>
                      <span>
                        <strong className="platform-cell-strong">{memberName(m)}</strong>
                        <span className="platform-perm-key">{m.user_id.slice(0, 8)}…</span>
                      </span>
                    </div>
                  </td>
                  <td>{LEVEL_KEY[m.member_role] ? t(LEVEL_KEY[m.member_role]) : m.member_role}</td>
                  <td>
                    <span className={`ux-badge ${m.status === "active" ? "ux-badge-approved" : "ux-badge-returned"}`}>{m.status === "active" ? t("status.active") : t("status.suspended")}</span>
                  </td>
                  <td>
                    {busyId === m.id ? <LoaderCircle size={15} className="spin platform-muted" /> : !canLifecycle ? (
                      <span className="platform-muted">{t("detail.managedByOwner")}</span>
                    ) : m.status === "active" ? (
                      <button type="button" onClick={() => { setPending({ member: m, status: "suspended" }); setReason(""); setSaveError(null) }} className="button-outline platform-warn">
                        <PauseCircle size={13} /> {t("detail.suspendMember")}
                      </button>
                    ) : (
                      <button type="button" onClick={() => { setPending({ member: m, status: "active" }); setReason(""); setSaveError(null) }} className="button-outline platform-ok">
                        <PlayCircle size={13} /> {t("detail.reactivateMember")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      {pending ? (
        <Dialog
          title={pending.status === "suspended" ? t("detail.suspend.title", { name: memberName(pending.member) }) : t("detail.reactivate.title", { name: memberName(pending.member) })}
          closeLabel={t("companies.cancel")}
          onClose={() => setPending(null)}>
          <p className="ux-dialog-hint">
            {pending.status === "suspended" ? t("detail.suspend.hint") : t("detail.reactivate.hint")}
          </p>
          <label>{t("companies.reason")}
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} data-autofocus />
          </label>
          {saveError ? <p className="inspection-alert" role="alert">{saveError}</p> : null}
          <div className="inspection-modal-actions">
            <button type="button" className="button-outline" onClick={() => setPending(null)}>{t("companies.cancel")}</button>
            <button type="button" className="button-primary" onClick={confirmStatus} disabled={reason.trim().length < 3 || busyId !== null}>
              {busyId ? <LoaderCircle size={14} className="spin" /> : null}
              {pending.status === "suspended" ? t("detail.suspendMember") : t("detail.reactivateMember")}
            </button>
          </div>
        </Dialog>
      ) : null}
    </section>
  )
}
