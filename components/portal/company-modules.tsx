"use client"

import { useCallback, useEffect, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { rpc } from "@/lib/portal/api"
import { dateLocale, tryCopy, useFriendlyError, usePortalLang, useT, type CopyKey } from "@/lib/portal/i18n"
import { Dialog } from "@/components/sentriq/dialog"
import type { CompanyRow } from "./companies"
import { PortalError, PortalLoading } from "./states"

interface ModuleRow { module_key: string; label: string; enabled: boolean }
interface GrantRow { id: string; module_key: string | null; membership_id: string | null; starts_at: string; expires_at: string | null; status: string; revoked_at: string | null }
type Treatment = "complimentary" | "platform_absorbed" | "tenant_billable"

const live = (g: GrantRow) => g.module_key !== null && g.membership_id === null && g.status === "active" && !g.revoked_at
  && new Date(g.starts_at) <= new Date() && (g.expires_at === null || new Date(g.expires_at) > new Date())

/** Company-wide module switches. On = a live platform grant; off = none. Turning on issues a grant
 *  (defaults: starts now, one year, complimentary, adjustable before confirming). Turning off revokes
 *  the live company grants with a reason. Every call is audited by the server. */
export function CompanyModules({ accessToken, company, canIssue = true, onClose }: { accessToken: string; company: CompanyRow; canIssue?: boolean; onClose: () => void }) {
  const t = useT()
  const fe = useFriendlyError()
  const lang = usePortalLang()
  const [modules, setModules] = useState<ModuleRow[] | null>(null)
  const [grants, setGrants] = useState<GrantRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((n) => n + 1), [])
  const [acting, setActing] = useState<{ module: ModuleRow; on: boolean } | null>(null)
  const [reason, setReason] = useState("")
  const [treatment, setTreatment] = useState<Treatment>("complimentary")
  const [days, setDays] = useState(365)
  const [endDate, setEndDate] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [price, setPrice] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setError(null)
    Promise.all([
      rpc<{ rows: ModuleRow[] }>("platform_read_company", { p_tenant_id: company.id, p_resource: "core.modules", p_limit: 100 }, accessToken),
      rpc<{ rows: GrantRow[] }>("platform_read_company", { p_tenant_id: company.id, p_resource: "core.entitlement_grants", p_limit: 100 }, accessToken),
    ]).then(([m, g]) => { if (active) { setModules((m.rows ?? []).filter((x) => x.enabled)); setGrants(g.rows ?? []) } })
      .catch((e) => { if (active) setError(fe(e)) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, company.id, tick])

  const liveFor = (key: string) => grants.filter((g) => g.module_key === key && live(g))
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(lang))
  const nameOf = (m: ModuleRow) => tryCopy(lang, `module.${m.module_key}`) ?? m.label

  function open(m: ModuleRow, on: boolean) {
    setActing({ module: m, on }); setReason(""); setErr(null); setTreatment("complimentary"); setDays(365); setEndDate(""); setPrice("")
  }

  async function confirm() {
    if (!acting) return
    setBusy(true); setErr(null)
    try {
      if (acting.on) {
        const start = new Date()
        const end = endDate ? new Date(`${endDate}T23:59:59Z`) : new Date(start.getTime() + Math.max(1, days) * 86400000)
        const billable = treatment === "tenant_billable"
        await rpc("issue_entitlement_grant", {
          p_tenant_id: company.id, p_module_key: acting.module.module_key, p_feature_key: null, p_membership_id: null,
          p_starts_at: start.toISOString(), p_expires_at: end.toISOString(), p_reason: reason.trim(), p_billing_treatment: treatment,
          p_currency: billable ? currency.trim().toUpperCase() : null,
          p_unit_price_minor: billable ? Math.round(Number(price) * 100) : null, p_quota: null,
        }, accessToken)
      } else {
        for (const g of liveFor(acting.module.module_key)) await rpc("revoke_entitlement_grant", { p_grant_id: g.id, p_reason: reason.trim() }, accessToken)
      }
      setActing(null); reload()
    } catch (e) { setErr(fe(e)) } finally { setBusy(false) }
  }

  const needsPrice = treatment === "tenant_billable"
  const okEnable = reason.trim().length >= 3 && (!needsPrice || (/^[A-Za-z]{3}$/.test(currency.trim()) && Number(price) >= 0 && price !== "")) && (endDate !== "" || days >= 1)

  return (
    <Dialog title={t("modules.title", { name: company.name })} closeLabel={t("modules.close")} onClose={onClose}>
      <p className="ux-dialog-hint">{t("modules.hint")}</p>
      {error ? <PortalError message={error} onRetry={reload} /> : !modules ? <PortalLoading label={t("companies.loading")} />
        : modules.length === 0 ? <p className="platform-muted">{t("modules.empty")}</p> : (
        <div className="invite-keys">
          {modules.map((m) => {
            const lv = liveFor(m.module_key)
            const on = lv.length > 0
            const latest = lv.map((g) => g.expires_at).filter(Boolean).sort().pop()
            return (
              <div key={m.module_key} className="invite-key-row" data-module={m.module_key}>
                <span><strong>{nameOf(m)}</strong> <span className={`ux-badge ${on ? "ux-badge-approved" : "b-grey"}`}>{on ? t("modules.on") : t("modules.off")}</span>
                  {on && latest && new Date(latest).getFullYear() < 3000 ? <span className="platform-muted"> {t("modules.until", { date: fmt(latest) })}</span> : null}</span>
                {canIssue ? (on
                  ? <button type="button" className="button-outline platform-warn" onClick={() => open(m, false)}>{t("modules.disable")}</button>
                  : <button type="button" className="button-outline platform-ok" onClick={() => open(m, true)}>{t("modules.enable")}</button>) : null}
              </div>
            )
          })}
        </div>
      )}
      {acting ? (
        <Dialog title={t(acting.on ? "modules.enable.title" : "modules.disable.title", { module: nameOf(acting.module), name: company.name })} closeLabel={t("companies.cancel")} onClose={() => setActing(null)}>
          <p className="ux-dialog-hint">{t(acting.on ? "modules.enable.hint" : "modules.disable.hint")}</p>
          <div className="invite-form">
            {acting.on ? (<>
              <label>{t("modules.field.treatment")}
                <select value={treatment} onChange={(e) => setTreatment(e.target.value as Treatment)}>
                  {(["complimentary", "platform_absorbed", "tenant_billable"] as Treatment[]).map((x) => <option key={x} value={x}>{t(`modules.treatment.${x}` as CopyKey)}</option>)}
                </select>
              </label>
              <label>{t("modules.field.days")}<input type="number" min={1} max={3650} value={days} disabled={endDate !== ""} onChange={(e) => setDays(Number(e.target.value) || 365)} /></label>
              <label>{t("modules.field.end")}<input type="date" min={new Date().toISOString().slice(0, 10)} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
              {needsPrice ? (<>
                <label>{t("modules.field.currency")}<input value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value)} dir="ltr" /></label>
                <label>{t("modules.field.price")}<input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} dir="ltr" /></label>
              </>) : null}
            </>) : null}
            <label>{t("modules.reason")}<textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} data-autofocus /></label>
            {err ? <p className="inspection-alert" role="alert">{err}</p> : null}
            <div className="inspection-modal-actions">
              <button type="button" className="button-outline" onClick={() => setActing(null)}>{t("companies.cancel")}</button>
              <button type="button" className="button-primary" disabled={busy || (acting.on ? !okEnable : reason.trim().length < 3)} onClick={confirm}>
                {busy ? <LoaderCircle size={14} className="spin" /> : null} {t(acting.on ? "modules.confirm.enable" : "modules.confirm.disable")}
              </button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </Dialog>
  )
}
