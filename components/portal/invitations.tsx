"use client"

import { useCallback, useEffect, useState } from "react"
import { LoaderCircle, MailPlus } from "lucide-react"
import { rpc } from "@/lib/portal/api"
import { dateLocale, useFriendlyError, usePortalLang, useT } from "@/lib/portal/i18n"

interface InviteRow { id: string; email: string; intended_level: string; created_at: string; expires_at: string }
type InviteMode = "superadmin" | "member"

/** Invite a person to a company and manage pending invites.
 *  superadmin: platform operator inviting the company's first/next superadmin.
 *  member: company superadmin inviting an admin or an employee. */
export function Invitations({ accessToken, tenantId, mode }: { accessToken: string; tenantId: string; mode: InviteMode }) {
  const t = useT()
  const fe = useFriendlyError()
  const lang = usePortalLang()
  const [rows, setRows] = useState<InviteRow[] | null>(null)
  const [email, setEmail] = useState("")
  const [level, setLevel] = useState<"company_admin" | "employee">("employee")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const load = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    let active = true
    rpc<{ rows?: InviteRow[] }>("company_pending_invitations", { p_tenant_id: tenantId }, accessToken)
      .then((res) => { if (active) setRows(res.rows ?? []) })
      .catch((e) => { if (active) { setRows([]); setError(fe(e)) } })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, tenantId, tick])

  async function send() {
    const needsReason = mode === "superadmin"
    if (!/^\S+@\S+\.\S+$/.test(email.trim()) || (needsReason && reason.trim().length < 3)) return
    setBusy(true); setError(null); setCode(null)
    try {
      const res = mode === "superadmin"
        ? await rpc<{ token?: string }[] | { token?: string }>("create_company_superadmin_invitation", {
            p_tenant_id: tenantId, p_email: email.trim(), p_ttl: "7 days", p_limits: [], p_reason: reason.trim(),
          }, accessToken)
        : await rpc<{ token?: string }[] | { token?: string }>("create_company_invitation", {
            p_tenant_id: tenantId, p_email: email.trim(), p_level: level, p_ttl: "7 days",
          }, accessToken)
      const first = Array.isArray(res) ? res[0] : res
      setCode(first?.token ?? null)
      setEmail(""); setReason("")
      load()
    } catch (e) {
      setError(fe(e))
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string) {
    const why = window.prompt(t("invite.revokeReason"))
    if (!why || why.trim().length < 3) return
    setError(null)
    try {
      await rpc(mode === "superadmin" ? "platform_revoke_invitation" : "revoke_invitation", { p_invitation_id: id, p_reason: why.trim() }, accessToken)
      load()
    } catch (e) { setError(fe(e)) }
  }

  return (
    <section className="panel platform-panel invitations">
      <div className="panel-header">
        <div>
          <h2>{mode === "superadmin" ? t("invite.superadmin.title") : t("invite.member.title")}</h2>
          <p>{mode === "superadmin" ? t("invite.superadmin.hint") : t("invite.member.hint")}</p>
        </div>
      </div>
      <div className="access-save-row invite-form">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("invite.email")} aria-label={t("invite.email")} />
        {mode === "member" ? (
          <select value={level} onChange={(e) => setLevel(e.target.value as "company_admin" | "employee")} aria-label={t("people.level")}>
            <option value="employee">{t("level.employee")}</option>
            <option value="company_admin">{t("level.company_admin")}</option>
          </select>
        ) : (
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("perms.reason")} aria-label={t("perms.reason")} />
        )}
        <button type="button" className="button-primary" onClick={send} disabled={busy}>
          {busy ? <LoaderCircle size={14} className="spin" /> : <MailPlus size={14} />} {t("invite.send")}
        </button>
      </div>
      {code ? <p className="ux-dialog-hint" role="status">{t("invite.created", { code })}</p> : null}
      {error ? <p className="inspection-alert" role="alert">{error}</p> : null}
      {rows && rows.length > 0 ? (
        <table className="data-table">
          <thead><tr><th>{t("invite.email")}</th><th>{t("people.level")}</th><th>{t("invite.expires")}</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.email}</td>
                <td>{r.intended_level === "company_superadmin" ? t("level.company_superadmin") : r.intended_level === "company_admin" ? t("level.company_admin") : t("level.employee")}</td>
                <td>{new Date(r.expires_at).toLocaleDateString(dateLocale(lang))}</td>
                <td><button type="button" className="button-outline" onClick={() => revoke(r.id)}>{t("invite.revoke")}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : rows ? <p className="platform-muted">{t("invite.none")}</p> : null}
    </section>
  )
}
