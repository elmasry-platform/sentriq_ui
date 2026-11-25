"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Copy, LoaderCircle, Plus } from "lucide-react"
import { rpc } from "@/lib/portal/api"
import { dateLocale, tryCopy, useFriendlyError, usePortalLang, useT, type CopyKey } from "@/lib/portal/i18n"
import { permissionLabel } from "@/lib/portal/perm-label"
import { ROLE_PRESETS, isOperational, presetKeys, type CatalogKey, type PresetId } from "@/lib/portal/presets"
import { Dialog } from "@/components/sentriq/dialog"
import type { CompanyRow } from "./companies"
import { PortalEmpty, PortalError, PortalLoading } from "./states"

interface InvitationRow {
  id: string; tenant_id: string; company_name: string; email: string; invitee_name: string | null; intended_level: string
  origin: string; created_at: string; expires_at: string; status: "pending" | "accepted" | "expired" | "revoked"
  revoke_reason: string | null; decision_count: number
}
type Choice = "default" | "allow" | "deny"
const LEVEL_KEY: Record<string, CopyKey> = {
  company_superadmin: "level.company_superadmin", company_admin: "level.company_admin", employee: "level.employee",
}
const STATUS_TONE: Record<string, string> = { pending: "b-blue", accepted: "ux-badge-approved", expired: "b-grey", revoked: "ux-badge-returned" }

/** Operator mode (Owner, Sub-owner): any company, any level. Company mode (Superadmin): own company, Admins and Employees (never Superadmin).
 *  The server enforces both; the form only offers what the caller may do. The one-time link is shown once. */
export function InvitationsPage({ accessToken, ownTenantId }: { accessToken: string; ownTenantId?: string }) {
  const t = useT()
  const fe = useFriendlyError()
  const lang = usePortalLang()
  const [rows, setRows] = useState<InvitationRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((n) => n + 1), [])
  const [creating, setCreating] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("company"))
  const [revoking, setRevoking] = useState<InvitationRow | null>(null)
  const [created, setCreated] = useState<{ email: string; link: string } | null>(null)

  useEffect(() => {
    let active = true
    setError(null)
    rpc<{ rows: InvitationRow[] }>("list_invitations", { p_tenant_id: ownTenantId ?? null, p_status: null, p_limit: 100 }, accessToken)
      .then((r) => { if (active) setRows(r.rows ?? []) })
      .catch((e) => { if (active) { setRows([]); setError(fe(e)) } })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, ownTenantId, tick])

  useEffect(() => {
    if (ownTenantId) return
    rpc<{ rows: CompanyRow[] }>("platform_list_companies", { p_limit: 100 }, accessToken)
      .then((r) => setCompanies((r.rows ?? []).filter((c) => c.status === "active")))
      .catch(() => setCompanies([]))
  }, [accessToken, ownTenantId])

  const fmt = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(lang))

  return (
    <div className="panel platform-panel" data-testid="invitations">
      <div className="panel-header">
        <div><h2>{t("invites.title")}</h2></div>
        <button type="button" className="button-primary" onClick={() => setCreating(true)}><Plus size={14} /> {t("invites.new")}</button>
      </div>
      {error ? <PortalError message={error} onRetry={reload} /> : !rows ? <PortalLoading label={t("companies.loading")} />
        : rows.length === 0 ? <PortalEmpty title={t("invites.empty")} hint={t("invites.subtitle")} />
        : (
          <table className="data-table">
            <thead><tr>
              <th>{t("invites.col.person")}</th>{ownTenantId ? null : <th>{t("invites.col.company")}</th>}<th>{t("invites.col.status")}</th><th>{t("invites.col.expires")}</th><th>{t("invites.col.actions")}</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="cell-wrap" data-label={t("invites.col.person")}><strong className="platform-cell-strong">{r.invitee_name ?? r.email}</strong>{r.invitee_name ? <div className="platform-muted">{r.email}</div> : null}
                    <div className="platform-muted">{LEVEL_KEY[r.intended_level] ? t(LEVEL_KEY[r.intended_level]) : r.intended_level} · {r.decision_count > 0 ? t("invites.access.count", { count: r.decision_count }) : t("invites.access.none")}</div></td>
                  {ownTenantId ? null : <td className="cell-wrap" data-label={t("invites.col.company")}>{r.company_name}</td>}
                  <td data-label={t("invites.col.status")}><span className={`ux-badge ${STATUS_TONE[r.status]}`}>{t(`invites.status.${r.status}` as CopyKey)}</span>{r.revoke_reason && r.status === "revoked" ? <div className="platform-muted">{r.revoke_reason}</div> : null}</td>
                  <td data-label={t("invites.col.expires")}>{fmt(r.expires_at)}</td>
                  <td>{r.status === "pending" ? <button type="button" className="button-outline platform-warn" onClick={() => setRevoking(r)}>{t("invites.revoke")}</button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      {creating ? <CreateInvitation accessToken={accessToken} ownTenantId={ownTenantId} companies={companies} onClose={() => setCreating(false)}
        onCreated={(email, link) => { setCreating(false); setCreated({ email, link }); reload() }} /> : null}
      {revoking ? <RevokeDialog accessToken={accessToken} row={revoking} onClose={() => setRevoking(null)} onDone={() => { setRevoking(null); reload() }} /> : null}
      {created ? <LinkDialog email={created.email} link={created.link} onClose={() => setCreated(null)} /> : null}
    </div>
  )
}

function CreateInvitation({ accessToken, ownTenantId, companies, onClose, onCreated }: {
  accessToken: string; ownTenantId?: string; companies: CompanyRow[]; onClose: () => void; onCreated: (email: string, link: string) => void
}) {
  const t = useT()
  const fe = useFriendlyError()
  const lang = usePortalLang()
  const qs = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search)
  const [tenantId, setTenantId] = useState(ownTenantId ?? qs.get("company") ?? "")
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [level, setLevel] = useState(ownTenantId ? "employee" : qs.get("level") === "company_superadmin" ? "company_superadmin" : "employee")
  const [days, setDays] = useState(7)
  const [catalog, setCatalog] = useState<CatalogKey[]>([])
  useEffect(() => {
    let active = true
    rpc<CatalogKey[]>("list_permission_catalog", {}, accessToken).then((r) => { if (active) setCatalog(Array.isArray(r) ? r : []) }).catch(() => { if (active) setCatalog([]) })
    return () => { active = false }
  }, [accessToken])
  const allKeys = useMemo(() => catalog.filter(isOperational).map((k) => k.permission_key), [catalog])
  const [choices, setChoices] = useState<Record<string, Choice>>({})
  const [reason, setReason] = useState("")
  const [moreOpen, setMoreOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const levels = ownTenantId ? ["company_admin", "employee"] : ["company_superadmin", "company_admin", "employee"]
  const decisions = useMemo(() => Object.entries(choices).filter(([, c]) => c !== "default").map(([permission_key, decision]) => ({ permission_key, decision })), [choices])
  const withAccess = level !== "company_superadmin"
  const valid = !!tenantId && /.+@.+\..+/.test(email.trim()) && name.trim().length > 0 && (!withAccess || decisions.length === 0 || reason.trim().length >= 3)

  const preset = (id: PresetId) => setChoices(Object.fromEntries(presetKeys(id, catalog).map((k) => [k, "allow" as Choice])))

  async function submit() {
    setBusy(true); setErr(null)
    try {
      const ttl = `${Math.min(30, Math.max(1, days))} days`
      const dec = withAccess ? decisions : []
      const res = ownTenantId
        ? await rpc<{ invitation_id: string; token: string }[]>("create_company_invitation", {
            p_tenant_id: tenantId, p_email: email.trim(), p_level: level, p_ttl: ttl, p_name: name.trim(), p_decisions: dec, p_reason: dec.length ? reason.trim() : null,
          }, accessToken)
        : await rpc<{ invitation_id: string; token: string }[]>("platform_create_invitation", {
            p_tenant_id: tenantId, p_email: email.trim(), p_name: name.trim(), p_level: level, p_ttl: ttl, p_decisions: dec, p_reason: dec.length ? reason.trim() : "Invitation created",
          }, accessToken)
      const token = Array.isArray(res) ? res[0]?.token : (res as unknown as { token: string }).token
      if (!token) throw new Error("request_failed_500")
      onCreated(email.trim(), `${window.location.origin}/portal/accept/#token=${token}`)
    } catch (e) { setErr(fe(e)); setBusy(false) }
  }

  return (
    <Dialog title={t("invites.new")} closeLabel={t("companies.cancel")} onClose={onClose}>
      <div className="invite-form">
        {ownTenantId ? null : (
          <label>{t("invites.form.company")}
            <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} aria-label={t("invites.form.company")}>
              <option value="">—</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>)}
        <label>{t("invites.form.name")}<input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} data-autofocus /></label>
        <label>{t("invites.form.email")}<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} /></label>
        <label>{t("invites.form.level")}
          <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label={t("invites.form.level")}>
            {levels.map((l) => <option key={l} value={l}>{t(LEVEL_KEY[l])}</option>)}
          </select>
        </label>
        <details className="more-options" open={moreOpen || decisions.length > 0} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
        <summary>{t("more.options")}</summary>
        <label>{t("invites.form.days")}<input type="number" min={1} max={30} value={days} onChange={(e) => setDays(Number(e.target.value) || 7)} /></label>
        <fieldset className="invite-access">
          <legend>{t("invites.form.access")}</legend>
          {!withAccess ? <p className="platform-muted">{t("invites.form.noAccess")}</p> : (
            <>
              <p className="access-audit-note">{t("invites.form.access.hint")}</p>
              <div className="access-presets">
                {ROLE_PRESETS.map((p) => <button key={p.id} type="button" className="button-outline" title={t(p.hintKey)} onClick={() => preset(p.id)}>{t(p.labelKey)}</button>)}
                <button type="button" className="button-outline" onClick={() => setChoices({})}>{t("ea.perms.choice.default")}</button>
              </div>
              <div className="invite-keys">
                {allKeys.map((k) => {
                  const c = choices[k] ?? "default"
                  const label = permissionLabel(k, (ck) => tryCopy(lang, ck))
                  return (
                    <div key={k} className="invite-key-row">
                      <span>{label}</span>
                      <div className="seg" role="radiogroup" aria-label={label}>
                        {(["default", "allow", "deny"] as Choice[]).map((o) => (
                          <button key={o} type="button" role="radio" aria-checked={c === o} className={`seg-option${c === o ? ` seg-on-${o}` : ""}`} onClick={() => setChoices((prev) => ({ ...prev, [k]: o }))}>{t(`ea.perms.choice.${o}` as CopyKey)}</button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
              {decisions.length > 0 ? <label>{t("invites.form.reason")}<input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></label> : null}
            </>
          )}
        </fieldset>
        </details>
        <div className="invite-sticky">
          {err ? <p className="inspection-alert" role="alert">{err}</p> : null}
          <div className="inspection-modal-actions">
            <button type="button" className="button-outline" onClick={onClose}>{t("companies.cancel")}</button>
            <button type="button" className="button-primary" disabled={!valid || busy} onClick={submit}>{busy ? <LoaderCircle size={14} className="spin" /> : null} {t("invites.form.submit")}</button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}

function RevokeDialog({ accessToken, row, onClose, onDone }: { accessToken: string; row: InvitationRow; onClose: () => void; onDone: () => void }) {
  const t = useT()
  const fe = useFriendlyError()
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function go() {
    setBusy(true); setErr(null)
    try { await rpc("revoke_invitation", { p_invitation_id: row.id, p_reason: reason.trim() }, accessToken); onDone() } catch (e) { setErr(fe(e)); setBusy(false) }
  }
  return (
    <Dialog title={t("invites.revoke.title")} closeLabel={t("companies.cancel")} onClose={onClose}>
      <p className="ux-dialog-hint">{t("invites.revoke.hint")}</p>
      <label>{t("companies.reason")}<textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} data-autofocus /></label>
      {err ? <p className="inspection-alert" role="alert">{err}</p> : null}
      <div className="inspection-modal-actions">
        <button type="button" className="button-outline" onClick={onClose}>{t("companies.cancel")}</button>
        <button type="button" className="button-primary" disabled={reason.trim().length < 3 || busy} onClick={go}>{t("invites.revoke.confirm")}</button>
      </div>
    </Dialog>
  )
}

function LinkDialog({ email, link, onClose }: { email: string; link: string; onClose: () => void }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  return (
    <Dialog title={t("invites.created.title")} closeLabel={t("invites.created.close")} onClose={onClose}>
      <p className="ux-dialog-hint">{t("invites.created.hint", { email })}</p>
      <input readOnly value={link} aria-label={t("invites.created.copy")} onFocus={(e) => e.currentTarget.select()} className="invite-link" dir="ltr" />
      <div className="inspection-modal-actions">
        <button type="button" className="button-outline" onClick={async () => { await navigator.clipboard.writeText(link).catch(() => {}); setCopied(true) }}><Copy size={14} /> {copied ? t("invites.created.copied") : t("invites.created.copy")}</button>
        <button type="button" className="button-primary" onClick={onClose}>{t("invites.created.close")}</button>
      </div>
    </Dialog>
  )
}
