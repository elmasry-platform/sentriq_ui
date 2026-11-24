"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import {
  Building2, ChevronLeft, ChevronRight, LogOut, Menu, ShieldCheck, UsersRound, X, KeyRound,
  PackageCheck, type LucideIcon,
} from "lucide-react"
import { usePortalSession } from "@/lib/portal/session"
import { resolveIdentity, type PortalIdentity, type PortalRole } from "@/lib/portal/identity"
import { LoadingState, ErrorState, PermissionDenied } from "@/components/sentriq/states"

export const ROLE_LABEL: Record<PortalRole, string> = {
  owner: "Platform Owner",
  subowner: "Sub-owner",
  superadmin: "Company Superadmin",
  admin: "Company Admin",
  employee: "Employee",
}
export function roleLabel(role: PortalRole) { return ROLE_LABEL[role] }

type NavItem = { label: string; href: string; icon: LucideIcon }

const platformNav: Record<PortalRole, NavItem[]> = {
  owner: [
    { label: "Companies", href: "/portal/owner", icon: Building2 },
    { label: "Operators", href: "/portal/owner/operators", icon: UsersRound },
  ],
  subowner: [{ label: "Companies", href: "/portal/subowner", icon: Building2 }],
  superadmin: [
    { label: "People & access", href: "/portal/superadmin", icon: UsersRound },
    { label: "Entitlements", href: "/portal/superadmin/entitlements", icon: PackageCheck },
  ],
  admin: [{ label: "Team", href: "/portal/admin", icon: UsersRound }],
  employee: [{ label: "My access", href: "/portal/employee", icon: KeyRound }],
}

function initials(email: string) {
  const base = email.split("@")[0].replace(/[^a-zA-Z]/g, " ").trim().split(/\s+/)
  const letters = base.map((part) => part.charAt(0).toUpperCase()).join("")
  return (letters || email.charAt(0).toUpperCase()).slice(0, 2) || "S"
}

/**
 * The platform area rendered inside the SENTRIQ product shell:
 * same sidebar, topbar, panels and tables as the workspace, but
 * authenticated for real and shaped by the caller's actual role.
 */
export function PlatformShell({
  expect,
  route,
  title,
  subtitle,
  children,
}: {
  expect: PortalRole
  route: string
  title: string
  subtitle?: string
  children: (ctx: { session: { accessToken: string; userId: string; email: string }; identity: PortalIdentity; reload: () => void }) => ReactNode
}) {
  const router = useRouter()
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
    return <div className="platform-boot"><LoadingState label="Checking your session" /></div>
  }
  if (resolving || !identity) {
    return error
      ? <div className="platform-boot"><ErrorState title={error} onRetry={reload} retryLabel="Try again" /></div>
      : <div className="platform-boot"><LoadingState label="Resolving your access" /></div>
  }
  if (identity.role !== expect) {
    return (
      <div className="platform-boot">
        <PermissionDenied
          title="This area needs a different role"
          reason={`Your account is signed in as ${ROLE_LABEL[identity.role]}. Open your own platform area instead.`}
          backHref="/portal"
          backLabel="Go to my platform area"
        />
        <div className="platform-boot-signout"><button type="button" className="button-outline" onClick={handleSignOut}><LogOut size={14} /> Sign out</button></div>
      </div>
    )
  }

  const platformItems = platformNav[identity.role]
  const noCompany = identity.role === "employee" && !identity.tenantId && identity.membershipStatus === "none"
  const displayLabel = noCompany ? "No company membership" : ROLE_LABEL[identity.role]
  const navLink = (item: NavItem) => {
    const active = route === item.href || route.startsWith(`${item.href}/`)
    return (
      <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
        className={`nav-link${active ? " nav-link-active" : ""}`}
        aria-current={active ? "page" : undefined}
        title={collapsed ? item.label : undefined}>
        <item.icon size={18} strokeWidth={1.8} /><span className="nav-link-text">{item.label}</span>
      </Link>
    )
  }

  return (
    <div className="app-shell sq-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside id="primary-navigation" className={`sidebar${collapsed ? " sidebar-collapsed" : ""}${mobileOpen ? " sidebar-mobile-open" : ""}`}>
        <Link className="brand" href="/portal" aria-label="SENTRIQ home">
          <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M23.5 6.5H13.2a6.7 6.7 0 0 0 0 13.4h5.6a6.7 6.7 0 0 1 0 13.4H8.5" transform="translate(0 -3.9)" stroke="currentColor" strokeWidth="2.1" strokeLinecap="square" /><circle cx="24" cy="4.8" r="2.1" fill="#D46A43" /></svg></span>
          {!collapsed && <span className="brand-name">SENTRIQ<span className="brand-period">.</span></span>}
        </Link>
        {mobileOpen && <button type="button" className="sidebar-close" aria-label="Close navigation" onClick={() => { setMobileOpen(false); menuButtonRef.current?.focus() }}><X size={19} /></button>}
        {!collapsed && <div className="workspace-label">PLATFORM · {displayLabel.toUpperCase()}</div>}
        <nav className="side-nav side-nav-admin" aria-label="Platform navigation">
          {platformItems.map((item) => navLink(item))}
        </nav>
        <div className="sidebar-bottom sq-sidebar-bottom">
          {!collapsed && <div className="sidebar-version"><span>SENTRIQ PLATFORM</span><span>LIVE</span></div>}
        </div>
        <button className="collapse-button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <button ref={menuButtonRef} type="button" className="mobile-menu-button" aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="primary-navigation" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Platform</span><ChevronRight size={14} /><strong>{title}</strong></div>
          <div className="topbar-actions">
            <span className="status-pill platform-role-pill"><ShieldCheck size={13} />{displayLabel}</span>
            <div className="topbar-divider profile-divider" />
            <div className="avatar-menu" ref={profileRef}>
              <button type="button" ref={profileButtonRef} className="avatar avatar-menu-trigger" aria-haspopup="dialog" aria-expanded={profileOpen} aria-controls="avatar-menu-panel" aria-label="Account and settings" onClick={() => setProfileOpen(!profileOpen)}>{initials(session.email)}</button>
              {profileOpen && <div id="avatar-menu-panel" className="avatar-menu-panel" role="dialog" aria-label="Account and settings">
                <div className="avatar-menu-head"><span className="avatar" aria-hidden="true">{initials(session.email)}</span><div><strong>{session.email}</strong><small>{displayLabel}</small></div></div>
                <button type="button" className="button-outline platform-signout" onClick={handleSignOut}><LogOut size={14} /> Sign out</button>
              </div>}
            </div>
          </div>
        </header>
        <main className="main-content" id="main-content" tabIndex={-1}>
          <div className="page-heading-row">
            <div>
              <p className="eyebrow">SENTRIQ PLATFORM</p>
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
