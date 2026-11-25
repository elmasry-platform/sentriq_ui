"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import {
  MailPlus, Building2, ChevronLeft, ChevronRight, LogOut, Menu, ShieldCheck, UsersRound, X, KeyRound,
  PackageCheck, Languages, type LucideIcon,
} from "lucide-react"
import { usePortalSession } from "@/lib/portal/session"
import { resolveIdentity, type PortalIdentity, type PortalRole } from "@/lib/portal/identity"
import { LoadingState, ErrorState, PermissionDenied } from "@/components/sentriq/states"
import { PortalLangProvider, t, useStoredPortalLang, type CopyKey, type PortalLang } from "@/lib/portal/i18n"

export const ROLE_KEY: Record<PortalRole, CopyKey> = {
  owner: "role.owner",
  subowner: "role.subowner",
  superadmin: "role.superadmin",
  admin: "role.admin",
  employee: "role.employee",
}

type NavItem = { labelKey: CopyKey; href: string; icon: LucideIcon }

const platformNav: Record<PortalRole, NavItem[]> = {
  owner: [
    { labelKey: "nav.companies", href: "/portal/owner", icon: Building2 },
    { labelKey: "nav.access", href: "/portal/owner/access", icon: KeyRound },
    { labelKey: "nav.invitations", href: "/portal/owner/invitations", icon: MailPlus },
    { labelKey: "nav.operators", href: "/portal/owner/operators", icon: UsersRound },
  ],
  subowner: [
    { labelKey: "nav.companies", href: "/portal/subowner", icon: Building2 },
    { labelKey: "nav.access", href: "/portal/subowner/access", icon: KeyRound },
    { labelKey: "nav.invitations", href: "/portal/subowner/invitations", icon: MailPlus },
  ],
  superadmin: [
    { labelKey: "nav.people", href: "/portal/superadmin", icon: UsersRound },
    { labelKey: "nav.access", href: "/portal/superadmin/access", icon: KeyRound },
    { labelKey: "nav.invitations", href: "/portal/superadmin/invitations", icon: MailPlus },
    { labelKey: "nav.entitlements", href: "/portal/superadmin/entitlements", icon: PackageCheck },
  ],
  admin: [{ labelKey: "nav.team", href: "/portal/admin", icon: UsersRound }],
  employee: [{ labelKey: "nav.myAccess", href: "/portal/employee", icon: KeyRound }],
}

function initials(email: string) {
  const base = email.split("@")[0].replace(/[^a-zA-Z]/g, " ").trim().split(/\s+/)
  const letters = base.map((part) => part.charAt(0).toUpperCase()).join("")
  return letters.slice(0, 2) || "U"
}

/**
 * The platform area rendered inside the SENTRIQ product shell:
 * same sidebar, topbar, panels and tables as the workspace, but
 * authenticated for real and shaped by the caller's actual role.
 */
export function PlatformShell(props: {
  expect: PortalRole
  route: string
  titleKey: CopyKey
  subtitleKey?: CopyKey
  children: (ctx: { session: { accessToken: string; userId: string; email: string }; identity: PortalIdentity; reload: () => void }) => ReactNode
}) {
  const [lang, changeLang] = useStoredPortalLang()
  return (
    <PortalLangProvider value={lang}>
      <PlatformShellInner {...props} lang={lang} onLangChange={changeLang} />
    </PortalLangProvider>
  )
}

function PlatformShellInner({
  expect,
  route,
  titleKey,
  subtitleKey,
  children,
  lang,
  onLangChange,
}: {
  expect: PortalRole
  route: string
  titleKey: CopyKey
  subtitleKey?: CopyKey
  children: (ctx: { session: { accessToken: string; userId: string; email: string }; identity: PortalIdentity; reload: () => void }) => ReactNode
  lang: PortalLang
  onLangChange: (next: PortalLang) => void
}) {
  const router = useRouter()
  const rtl = lang === "ar"
  const tt = (key: CopyKey, vars?: Record<string, string | number>) => t(lang, key, vars)
  const title = tt(titleKey)
  const subtitle = subtitleKey ? tt(subtitleKey) : undefined
  const { session, loading, signOut } = usePortalSession()
  const [identity, setIdentity] = useState<PortalIdentity | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const [tick, setTick] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const profileButtonRef = useRef<HTMLButtonElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (loading) return
    if (!session) { router.replace("/portal/login"); return }
    let active = true
    setResolving(true)
    setError(null)
    resolveIdentity(session.accessToken, session.userId)
      .then((id) => { if (active) setIdentity(id) })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "identity_resolution_failed") })
      .finally(() => { if (active) setResolving(false) })
    return () => { active = false }
  }, [session, loading, router, tick])

  useEffect(() => {
    if (!profileOpen) return
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setProfileOpen(false); profileButtonRef.current?.focus() } }
    const onDown = (event: MouseEvent) => { if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false) }
    document.addEventListener("keydown", onKey); document.addEventListener("mousedown", onDown)
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown) }
  }, [profileOpen])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setMobileOpen(false); menuButtonRef.current?.focus() } }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [mobileOpen])

  useEffect(() => { setMobileOpen(false); setProfileOpen(false) }, [route])

  const handleSignOut = useCallback(async () => {
    await signOut()
    router.replace("/portal/login")
  }, [signOut, router])

  if (loading || !session) {
    return <div className="platform-boot"><LoadingState label={tt("shell.boot.session")} /></div>
  }
  if (resolving || !identity) {
    return error
      ? <div className="platform-boot"><ErrorState title={error} onRetry={reload} retryLabel={tt("shell.retry")} /></div>
      : <div className="platform-boot"><LoadingState label={tt("shell.boot.identity")} /></div>
  }
  if (identity.role !== expect) {
    return (
      <div className="platform-boot">
        <PermissionDenied
          title={tt("shell.wrongRole.title")}
          reason={tt("shell.wrongRole.reason", { role: tt(ROLE_KEY[identity.role]) })}
          backHref="/portal"
          backLabel={tt("shell.wrongRole.back")}
        />
        <div className="platform-boot-signout"><button type="button" className="button-outline" onClick={handleSignOut}><LogOut size={14} /> {tt("shell.signout")}</button></div>
      </div>
    )
  }

  const platformItems = platformNav[identity.role]
  const noCompany = identity.role === "employee" && !identity.tenantId && identity.membershipStatus === "none"
  const areaLabel = identity.role === "owner" || identity.role === "subowner" ? tt("shell.platform") : tt("shell.company")
  const displayLabel = noCompany ? tt("role.none") : tt(ROLE_KEY[identity.role])
  const navLink = (item: NavItem) => {
    const longer = platformItems.some((o) => o.href.length > item.href.length && o.href.startsWith(`${item.href}/`) && (route === o.href || route.startsWith(`${o.href}/`)))
    const active = !longer && (route === item.href || route.startsWith(`${item.href}/`))
    const label = tt(item.labelKey)
    return (
      <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
        className={`nav-link${active ? " nav-link-active" : ""}`}
        aria-current={active ? "page" : undefined}
        title={collapsed ? label : undefined}>
        <item.icon size={18} strokeWidth={1.8} /><span className="nav-link-text">{label}</span>
      </Link>
    )
  }

  return (
    <div className={`app-shell sq-shell${rtl ? " is-rtl" : ""}`} dir={rtl ? "rtl" : "ltr"}>
      <a className="skip-link" href="#main-content">{tt("shell.skip")}</a>
      {mobileOpen && <button className="mobile-scrim" aria-label={tt("shell.closeNav")} onClick={() => setMobileOpen(false)} />}
      <aside id="primary-navigation" className={`sidebar${collapsed ? " sidebar-collapsed" : ""}${mobileOpen ? " sidebar-mobile-open" : ""}`}>
        <Link className="brand" href="/portal" aria-label="SENTRIQ home">
          <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M23.5 6.5H13.2a6.7 6.7 0 0 0 0 13.4h5.6a6.7 6.7 0 0 1 0 13.4H8.5" transform="translate(0 -3.9)" stroke="currentColor" strokeWidth="2.1" strokeLinecap="square" /><circle cx="24" cy="4.8" r="2.1" fill="#D46A43" /></svg></span>
          {!collapsed && <span className="brand-name">SENTRIQ<span className="brand-period">.</span></span>}
        </Link>
        {mobileOpen && <button type="button" className="sidebar-close" aria-label={tt("shell.closeNav")} onClick={() => { setMobileOpen(false); menuButtonRef.current?.focus() }}><X size={19} /></button>}
        {!collapsed && <div className="workspace-label">{areaLabel.toUpperCase()} · {displayLabel.toUpperCase()}</div>}
        <nav className="side-nav side-nav-admin" aria-label={areaLabel}>
          {platformItems.map((item) => navLink(item))}
        </nav>
        <div className="sidebar-bottom sq-sidebar-bottom">
          {!collapsed && <div className="sidebar-version"><span>SENTRIQ PLATFORM</span><span>{tt("shell.live")}</span></div>}
        </div>
        <button className="collapse-button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? tt("shell.expand") : tt("shell.collapse")} title={collapsed ? tt("shell.expand") : tt("shell.collapse")}>{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <button ref={menuButtonRef} type="button" className="mobile-menu-button" aria-label={tt("shell.openNav")} aria-expanded={mobileOpen} aria-controls="primary-navigation" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>{areaLabel}</span><ChevronRight size={14} /><strong>{title}</strong></div>
          <div className="topbar-actions">
            <button type="button" className="language-button" onClick={() => onLangChange(rtl ? "en" : "ar")} aria-label={rtl ? "Switch to English" : "التغيير إلى العربية"}><Languages size={16} /><span>{tt("lang.toggle")}</span></button>
            <span className="status-pill platform-role-pill"><ShieldCheck size={13} />{displayLabel}</span>
            <div className="topbar-divider profile-divider" />
            <div className="avatar-menu" ref={profileRef}>
              <button type="button" ref={profileButtonRef} className="avatar avatar-menu-trigger" aria-haspopup="dialog" aria-expanded={profileOpen} aria-controls="avatar-menu-panel" aria-label={tt("shell.account")} onClick={() => setProfileOpen(!profileOpen)}>{initials(session.email)}</button>
              {profileOpen && <div id="avatar-menu-panel" className="avatar-menu-panel" role="dialog" aria-label={tt("shell.account")}>
                <div className="avatar-menu-head"><span className="avatar" aria-hidden="true">{initials(session.email)}</span><div><strong>{session.email}</strong><small>{displayLabel}</small></div></div>
                <button type="button" className="button-outline platform-signout" onClick={handleSignOut}><LogOut size={14} /> {tt("shell.signout")}</button>
              </div>}
            </div>
          </div>
        </header>
        <main className="main-content" id="main-content" tabIndex={-1}>
          <div className="page-heading-row">
            <div>
              <p className="eyebrow">SENTRIQ {areaLabel.toUpperCase()}</p>
              <h1>{title}</h1>
              {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
            </div>
          </div>
          {children({ session, identity, reload })}
        </main>
      </div>
    </div>
  )
}
