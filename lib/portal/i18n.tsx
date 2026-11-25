"use client"

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState } from "react"
import { COPY } from "./copy"

export type PortalLang = "en" | "ar"


export type CopyKey = keyof (typeof COPY)["en"]

const LangContext = createContext<PortalLang>("en")

export const PortalLangProvider = LangContext.Provider

export function usePortalLang(): PortalLang {
  return useContext(LangContext)
}

export function t(lang: PortalLang, key: CopyKey, vars?: Record<string, string | number>): string {
  let s: string = COPY[lang][key] ?? COPY.en[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
  return s
}

/** Looks up a copy key that may not exist (catalog-driven labels). Returns null when absent. */
export function tryCopy(lang: PortalLang, key: string): string | null {
  const v = (COPY[lang] as Record<string, string>)[key]
  return typeof v === "string" ? v : null
}

export function useT() {
  const lang = usePortalLang()
  return (key: CopyKey, vars?: Record<string, string | number>) => t(lang, key, vars)
}

/** Standalone pages (login, portal index) live outside the shell provider:
 *  they read and persist the same language choice themselves. */
export function useStoredPortalLang(): [PortalLang, (next: PortalLang) => void] {
  const [lang, setLang] = useState<PortalLang>("en")
  useEffect(() => {
    const saved = window.localStorage.getItem("sentriq-portal-lang")
    if (saved === "ar" || saved === "en") setLang(saved)
  }, [])
  // Painted pages stay hidden (see layout) until the stored language is applied, so there is no English flash.
  useLayoutEffect(() => {
    const saved = window.localStorage.getItem("sentriq-portal-lang")
    if (saved === "ar" || saved === "en") setLang(saved)
    document.documentElement.removeAttribute("data-portal-pending")
  }, [])
  // Keep <html lang> and <html dir> in step with the page language (screen readers, fonts).
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr"
  }, [lang])
  const change = useCallback((next: PortalLang) => {
    setLang(next)
    window.localStorage.setItem("sentriq-portal-lang", next)
  }, [])
  return [lang, change]
}

export function dateLocale(lang: PortalLang): string {
  return lang === "ar" ? "ar-EG" : "en-GB"
}

/** Localized friendly error: maps audited API codes into the active language. */
export function friendlyErrorLang(lang: PortalLang, error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : ""
  const codeMap: Record<string, CopyKey> = {
    active_membership_already_exists: "err.inv.member",
    invitation_already_pending: "err.inv.pending",
    invitation_invalid_or_expired: "err.inv.invalid",
    verified_auth_email_required: "err.inv.email",
    membership_email_belongs_to_another_user: "err.inv.email",
    membership_already_active: "err.inv.member",
    permission_limited_for_inviter: "err.inv.limit",
    permission_not_entitled_for_inviter: "err.inv.limit",
    invitation_reason_required: "err.inv.reason",
    invitation_not_found_or_final: "err.inv.final",
    company_invitation_not_allowed: "err.inv.notAllowed",
    platform_invitation_not_allowed: "err.inv.notAllowed",
    invitation_list_not_allowed: "err.denied",
    company_name_taken: "err.company.taken",
    company_name_invalid: "err.company.invalid",
    insufficient_privilege: "err.privilege",
    invitation_decisions_invalid: "err.inv.decisions",
    invitation_decisions_duplicate_key: "err.inv.decisions",
    permission_key_not_in_enabled_catalog: "err.inv.catalog",
    invitation_reason_invalid: "err.inv.reasonInvalid",
    superadmin_initial_decisions_not_supported: "err.inv.superadminAccess",

    platform_membership_lifecycle_not_authorized: "err.withdrawn",
    platform_companies_read_not_authorized: "err.withdrawn",
    platform_operator_required: "err.operatorOnly",
    platform_owner_required: "err.ownerOnly",
    company_superadmin_required_for_membership_status: "err.superadminOnly",
    direct_permission_decision_not_delegated: "err.superadminOnly",
    direct_permission_clear_not_allowed: "err.superadminOnly",
    company_decisions_read_not_authorized: "err.denied",
    invalid_membership_status_transition: "err.transition",
    invalid_tenant_status_transition: "err.transition",
    membership_not_found: "err.notFound",
    tenant_not_found: "err.notFound",
    identity_resolution_failed: "err.identity",
    deny_removal_requires_setter_subowner_or_owner: "err.denyLocked",
    deny_removal_requires_creator_or_superadmin: "err.denyLocked",
    entitlement_delegation_not_authorized: "err.delegateNotAllowed",
    delegation_capability_not_authorized: "err.delegateNotAllowed",
    entitlement_delegation_revoke_not_authorized: "err.delegateRevoke",
    delegation_cannot_outlive_source: "err.delegateOutlive",
    delegation_expiry_in_past: "err.pastDate",
    effective_access_not_authorized: "err.accessScope",
    own_restriction_cannot_be_cleared: "err.ownRestriction",
    own_membership_decision_not_allowed: "err.ownRow",
    permission_not_entitled_for_member: "err.notEntitled",
    decision_origin_is_immutable: "err.operatorOrigin",
    operator_decision_requires_operator: "err.operatorOrigin",
    protected_origin_requires_operator: "err.operatorOrigin",
    superadmin_capability_limit_not_authorized: "err.capabilityLimit",
    request_failed_401: "err.session",
    request_failed_403: "err.denied",
    request_failed_404: "err.notFound",
    request_failed_429: "err.throttled",
  }
  if (/Could not find the function|schema cache|PGRST202/i.test(raw)) return t(lang, "err.notReady")
  if (raw && codeMap[raw]) return t(lang, codeMap[raw])
  if (/^[a-z0-9_]+_not_authorized$/.test(raw)) return t(lang, "err.withdrawn")
  if (/^[a-z0-9_]+$/.test(raw) || !raw) return t(lang, "generic.failed")
  return raw
}

export function useFriendlyError() {
  const lang = usePortalLang()
  return (error: unknown) => friendlyErrorLang(lang, error)
}
