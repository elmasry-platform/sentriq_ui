"use client"

import { useCallback, useEffect, useState } from "react"
import { Building2, ChevronRight, LoaderCircle, PauseCircle, PlayCircle } from "lucide-react"
import { rpc, ApiError } from "@/lib/portal/api"
import { dateLocale, useFriendlyError, usePortalLang, useT, type CopyKey } from "@/lib/portal/i18n"
import { Dialog } from "@/components/sentriq/dialog"
import { PortalEmpty, PortalError, PortalLoading } from "./states"

export interface CompanyRow { id: string; name: string; industry_label: string | null; status: string; created_at: string; member_count?: number }

export function CompanyStatusBadge({ status }: { status: string }) {
  const t = useT()
  const tone = status === "active" ? "ux-badge-approved" : status === "suspended" ? "ux-badge-in-review" : "ux-badge-returned"
  const label = status === "active" ? t("status.active") : status === "suspended" ? t("status.suspended") : t("status.closed")
  return <span className={`ux-badge ${tone}`}>{label}</span>
}

export function CompaniesPanel({ accessToken, allowLifecycle, canLifecycle = true, onOpen, openLabelKey = "companies.open" }: { accessToken: string; allowLifecycle: boolean; canLifecycle?: boolean; onOpen?: (company: CompanyRow) => void; openLabelKey?: CopyKey }) {
  const t = useT()
  const fe = useFriendlyError()
  const lang = usePortalLang()
  const [rows, setRows] = useState<CompanyRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [denied, setDenied] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pending, setPending] = useState<{ company: CompanyRow; status: "active" | "suspended" } | null>(null)
  const [reason, setReason] = useState("")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const load = useCallback(() => setTick((v) => v + 1), [])

  useEffect(() => {
    let active = true
    setError(null)
    rpc<{ rows: CompanyRow[] }>("platform_list_companies", { p_limit: 100 }, accessToken)
      .then((res) => { if (active) { setRows(res.rows ?? []); setDenied(false) } })
      .catch((e) => {
        if (!active) return
        if (e instanceof ApiError && e.status === 403) { setDenied(true); setRows([]) }
        else setError(fe(e))
      })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, tick])

  async function confirmStatus() {
    if (!pending || reason.trim().length < 3) return
    const { company, status } = pending
    setBusyId(company.id)
    try {
      await rpc("platform_set_tenant_status", { p_tenant_id: company.id, p_status: status, p_reason: reason.trim() }, accessToken)
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

  if (error) return <PortalError message={error} onRetry={load} />
  if (!rows) return <PortalLoading label={t("companies.loading")} />
  if (denied) return <PortalEmpty titleKey="companies.denied.title" hintKey="companies.denied.hint" />
  if (rows.length === 0) return <PortalEmpty titleKey="companies.empty.title" hintKey="companies.empty.hint" />

  return (
    <div className="panel platform-panel">
      <div className="panel-header">
        <div>
          <h2>{t("companies.title")}</h2>
          <p>{t("companies.subtitle")}</p>
        </div>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>{t("companies.company")}</th>
            <th>{t("companies.industry")}</th>
            <th>{t("companies.members")}</th>
            <th>{t("companies.status")}</th>
            <th>{t("companies.created")}</th>
            {allowLifecycle || onOpen ? <th>{t("companies.actions")}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td>
                <div className="platform-person">
                  <span className="avatar" aria-hidden="true"><Building2 size={14} /></span>
                  {onOpen ? (
                    <button type="button" onClick={() => onOpen(c)} className="platform-link-button">
                      {c.name}<ChevronRight size={13} />
                    </button>
                  ) : (
                    <strong className="platform-cell-strong">{c.name}</strong>
                  )}
                </div>
              </td>
              <td>{c.industry_label ?? "—"}</td>
              <td>{c.member_count ?? "—"}</td>
              <td><CompanyStatusBadge status={c.status} /></td>
              <td>{new Date(c.created_at).toLocaleDateString(dateLocale(lang))}</td>
              {allowLifecycle || onOpen ? (
                <td>
                  {onOpen ? <button type="button" onClick={() => onOpen(c)} className="button-outline">{t(openLabelKey)}</button> : null}{" "}
                  {busyId === c.id ? <LoaderCircle size={15} className="spin platform-muted" /> : allowLifecycle && canLifecycle && c.status === "active" ? (
                    <button type="button" onClick={() => { setPending({ company: c, status: "suspended" }); setReason(""); setSaveError(null) }} className="button-outline platform-warn">
                      <PauseCircle size={13} /> {t("companies.suspend")}
                    </button>
                  ) : allowLifecycle && canLifecycle && c.status === "suspended" ? (
                    <button type="button" onClick={() => { setPending({ company: c, status: "active" }); setReason(""); setSaveError(null) }} className="button-outline platform-ok">
                      <PlayCircle size={13} /> {t("companies.reactivate")}
                    </button>
                  ) : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {pending ? (
        <Dialog
          title={pending.status === "suspended" ? t("companies.suspend.title", { name: pending.company.name }) : t("companies.reactivate.title", { name: pending.company.name })}
          closeLabel={t("companies.cancel")}
          onClose={() => setPending(null)}>
          <p className="ux-dialog-hint">
            {pending.status === "suspended" ? t("companies.suspend.hint") : t("companies.reactivate.hint")}
          </p>
          <label>{t("companies.reason")}
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder={t("companies.reason.placeholder")} data-autofocus />
          </label>
          {saveError ? <p className="inspection-alert" role="alert">{saveError}</p> : null}
          <div className="inspection-modal-actions">
            <button type="button" className="button-outline" onClick={() => setPending(null)}>{t("companies.cancel")}</button>
            <button type="button" onClick={confirmStatus} disabled={reason.trim().length < 3 || busyId !== null} className="button-primary">
              {busyId ? <LoaderCircle size={14} className="spin" /> : null}
              {pending.status === "suspended" ? t("companies.confirm.suspend") : t("companies.confirm.reactivate")}
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  )
}
