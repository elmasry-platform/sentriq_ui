"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Bell, Building2, ChevronDown, ChevronLeft, ChevronRight,
  ClipboardCheck, ClipboardList, FileCheck2, FileText,
  HardHat, LayoutDashboard, Menu, Search, Settings2, ShieldCheck,
  UsersRound, X, Languages, AlertTriangle, ArrowRight, BookOpenCheck, BriefcaseBusiness,
  ChartNoAxesCombined, CircleDot, Factory, FolderOpen, Network, ScrollText, Siren, Users,
  Grid2X2, Star, Clock3, ListChecks, type LucideIcon,
} from "lucide-react"
import { demoRoles, mockSentriqDashboardService, type DemoRole } from "@/lib/sentriq/dashboard-service"
import { OverviewDashboard } from "@/components/sentriq/overview-dashboard"
import { PeopleDirectory } from "@/components/sentriq/people-directory"
import { FormsLibrary } from "@/components/sentriq/forms-library"
import { MyWork } from "@/components/sentriq/my-work"
import { AdminCenter } from "@/components/sentriq/admin-center"
import { Inspections } from "@/components/sentriq/inspections"
import { Actions } from "@/components/sentriq/actions"
import { actionRepository, isActionOverdue } from "@/lib/actions/repository"
import { inspectionRepository } from "@/lib/inspections/repository"
import { can, canReviewAnyStage, demoActor, reviewStagesFor } from "@/lib/sentriq/demo-permissions"
import type { Member } from "@/lib/sentriq/admin-data"

export type Language = "en" | "ar"

type NavigationItem = { label: string; ar: string; href: string; icon: LucideIcon; badge?: string }

function isSessionMember(value: unknown): value is Member {
  if (!value || typeof value !== "object") return false
  const member = value as Partial<Member>
  const validLevels = ["Company Superadmin", "Company Admin", "Employee"]
  const isStringArray = (items: unknown) => Array.isArray(items) && items.every((item) => typeof item === "string")
  return typeof member.id === "string" && typeof member.name === "string" && typeof member.email === "string"
    && validLevels.includes(member.level ?? "") && (member.status === "Active" || member.status === "Suspended")
    && isStringArray(member.roles) && isStringArray(member.sites) && isStringArray(member.units)
    && (member.activity === undefined || typeof member.activity === "string")
}

const navigation: NavigationItem[] = [
  { label: "Overview", ar: "نظرة عامة", href: "/app/dashboard", icon: LayoutDashboard },
  { label: "My Work", ar: "مساحة عملي", href: "/app/my-work", icon: ListChecks },
  { label: "Inspections", ar: "التفتيشات", href: "/app/inspections", icon: ClipboardCheck },
  { label: "Corrective actions", ar: "الإجراءات التصحيحية", href: "/app/actions", icon: HardHat },
  { label: "Forms library", ar: "مكتبة النماذج", href: "/app/forms", icon: ClipboardList },
]
const administration: NavigationItem[] = [
  { label: "Reports", ar: "التقارير", href: "/app/reports", icon: ChartNoAxesCombined },
  { label: "People", ar: "الأفراد", href: "/app/people", icon: UsersRound },
  { label: "Settings", ar: "الإعدادات", href: "/app/admin/workspace", icon: Settings2 },
  { label: "Platform", ar: "المنصة", href: "/portal", icon: ShieldCheck },
]

const modules = [
  { href: "/app/organization", name: "Organization & sites", group: "Enterprise foundation", state: "Planned", purpose: "A shared foundation for organizations, workspaces, operating locations, teams, and access boundaries.", workflow: "Organization → Workspace → Site → Team → Operational record", links: ["Workspaces", "Users & teams", "Inspections"] },
  { href: "/app/workspaces", name: "Workspaces", group: "Enterprise foundation", state: "Planned", purpose: "Separate operating contexts while keeping enterprise oversight connected.", workflow: "Organization → Workspace → Sites → Records", links: ["Organization & sites", "Users & teams"] },
  { href: "/app/teams", name: "Users & teams", group: "Enterprise foundation", state: "Planned", purpose: "Organize people and responsibilities around sites and operational workflows.", workflow: "Workspace → Team → Owner → Assigned action", links: ["Organization & sites", "Findings & actions"] },
  { href: "/app/forms", name: "Forms library", group: "QHSE operations", state: "Working prototype", purpose: "Create and manage reusable inspection form templates, with an existing form builder foundation.", workflow: "Draft form → Validate → Publish version → Use in inspection", links: ["Inspections", "Review inbox"] },
  { href: "/app/inspections", name: "Inspection management", group: "QHSE operations", state: "Preview", purpose: "Plan and review field inspections using reusable forms and a connected follow-through path.", workflow: "Form template → Inspection → Finding → Corrective action", links: ["Forms library", "Review inbox", "Findings & actions"] },
  { href: "/app/incidents", name: "Incident management", group: "QHSE operations", state: "Preview", purpose: "Structure incident and near-miss information for investigation, risk review, and follow-up.", workflow: "Incident → Investigation → Risk review → Action → Closure", links: ["Risk assessments", "Findings & actions", "Documents & evidence"] },
  { href: "/app/permits", name: "Permit to work", group: "QHSE operations", state: "Planned", purpose: "Provide a controlled home for work authorization and operational precautions.", workflow: "Request → Hazard review → Authorization → Closeout", links: ["Risk assessments", "Users & teams"] },
  { href: "/app/risks", name: "Risk assessments", group: "Risk & compliance", state: "Preview", purpose: "Connect hazards, controls, assigned actions, and residual risk monitoring.", workflow: "Hazard → Assessment → Controls → Residual risk", links: ["Incidents & observations", "Findings & actions"] },
  { href: "/app/compliance", name: "Audit & compliance", group: "Risk & compliance", state: "Preview", purpose: "Organize audits and compliance obligations around observations and accountable actions.", workflow: "Audit → Observation → Non-conformity → Action → Verification", links: ["Forms library", "Findings & actions", "Documents & evidence"] },
  { href: "/app/actions", name: "Findings & corrective actions", group: "Findings & actions", state: "Preview", purpose: "Turn operational issues into owned, time-bound actions with evidence, review, and closure.", workflow: "Finding → Assignment → Correction → Verification → Closure", links: ["Inspections", "Incidents & observations", "Audit & compliance"] },
  { href: "/app/evidence", name: "Documents & evidence", group: "Documents & resources", state: "Preview", purpose: "Keep supporting evidence visible alongside the inspections, risks, and actions it relates to.", workflow: "Record → Evidence → Review → Retention", links: ["Findings & actions", "Inspections", "Audit & compliance"] },
  { href: "/app/people", name: "People & Workforce", group: "Documents & resources", state: "Preview", purpose: "Directory of workspace memberships, assigned roles, and operational site scopes.", workflow: "Person → Membership → Functional role → Site scope", links: ["Users & teams", "Organization & sites"] },
  { href: "/app/assets", name: "Assets & equipment", group: "Documents & resources", state: "Planned", purpose: "Connect equipment identity, inspections, condition, and maintenance follow-up.", workflow: "Asset → Inspection → Defect → Maintenance action", links: ["Inspections", "Findings & actions"] },
  { href: "/app/environment", name: "Environmental records", group: "Documents & resources", state: "Planned", purpose: "A coherent place for environmental monitoring and operational records.", workflow: "Measure → Record → Review → Report", links: ["Documents & evidence", "Reports & analytics"] },
  { href: "/app/reports", name: "Reports & analytics", group: "Intelligence & governance", state: "Preview", purpose: "Give managers an aggregated view of operational activity and areas needing attention.", workflow: "Operational records → Trends → Management review", links: ["Inspections", "Findings & actions", "Audit & compliance"] },
  { href: "/app/audit", name: "Audit trail", group: "Intelligence & governance", state: "Planned", purpose: "A future traceable history of important record and workflow events.", workflow: "Event → Actor → Record → Review", links: ["Users & teams", "Reports & analytics"] },
  { href: "/app/reviews", name: "Review inbox", group: "QHSE operations", state: "Preview", purpose: "Bring pending submissions and review decisions into one focused queue.", workflow: "Submission → Review → Return or approve", links: ["Forms library", "Inspection management", "Findings & corrective actions"] },
  { href: "/app/follow-ups", name: "Follow-ups", group: "Findings & actions", state: "Preview", purpose: "Track the next steps connected to findings, reviews, and assigned actions.", workflow: "Assignment → Follow-up → Verification", links: ["Findings & corrective actions", "Review inbox"] },
]


const copy = {
  en: { workspace: "Workspace", search: "Search anything...", searchLabel: "Search workspace", role: "ROLE", simulation: "Preview role — interface view only, not access control. Everything here is sample data.", today: "Today", menu: "Open navigation", close: "Close navigation", home: "Home", modules: "Modules", directory: "View all modules", searchModules: "Search modules", noModules: "No modules match your search", categories: ["All modules", "Enterprise", "Operations", "Risk & compliance", "Actions", "Resources", "Intelligence"] },
  ar: { workspace: "مساحة العمل", search: "ابحث في مساحة العمل...", searchLabel: "البحث في مساحة العمل", role: "الدور", simulation: "دور معاينة — عرض للواجهة فقط وليس صلاحيات. كل البيانات هنا تجريبية.", today: "اليوم", menu: "فتح القائمة", close: "إغلاق القائمة", home: "الرئيسية", modules: "الوحدات", directory: "عرض جميع الوحدات", searchModules: "البحث عن وحدة", noModules: "لا توجد وحدات مطابقة", categories: ["كل الوحدات", "المؤسسة", "العمليات", "المخاطر والامتثال", "الإجراءات", "الموارد", "الذكاء"] },
}

export function AppShell({ route }: { route: string }) {
  const [language, setLanguage] = useState<Language>("en")
  const [workspaceId, setWorkspaceId] = useState("ws_northstar")
  const [role, setRole] = useState<DemoRole>("company_superadmin")
  const [sessionMembers, setSessionMembers] = useState<Member[]>([])
  const [sessionMembersLoaded, setSessionMembersLoaded] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [search, setSearch] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const profileButtonRef = useRef<HTMLButtonElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeNavRef = useRef<HTMLButtonElement>(null)
  const [attention, setAttention] = useState(0)
  const t = copy[language]
  const rtl = language === "ar"
  const data = useMemo(() => mockSentriqDashboardService.getDashboard(workspaceId), [workspaceId])

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem("sentriq-demo-people")
      const parsed: unknown = stored ? JSON.parse(stored) : []
      if (Array.isArray(parsed) && parsed.every(isSessionMember)) setSessionMembers(parsed)
    } catch {
      setSessionMembers([])
    } finally {
      setSessionMembersLoaded(true)
    }
  }, [])

  const addSessionMember = (member: Member) => {
    setSessionMembers((current) => {
      const next = [member, ...current]
      try { window.sessionStorage.setItem("sentriq-demo-people", JSON.stringify(next)) } catch {}
      return next
    })
  }
  const selectedModule = modules.find((module) => module.href === route) ?? modules.filter((module) => route.startsWith(`${module.href}/`)).sort((a, b) => b.href.length - a.href.length)[0]
  const current = navigation.find((item) => route === item.href || route.startsWith(`${item.href}/`)) ?? (selectedModule ? { label: selectedModule.name, ar: moduleArabic[selectedModule.name], href: selectedModule.href, icon: Network } : route.startsWith("/app/admin") ? administration[2] : { label: "My Work", ar: "مساحة عملي", href: "/app/actions", icon: ListChecks })
  const contextualGroups = [
    { label: "Inspections", routes: ["/app/inspections", "/app/forms", "/app/reviews"] },
    { label: "Findings & actions", routes: ["/app/actions", "/app/follow-ups"] },
    { label: "Risk & compliance", routes: ["/app/risks", "/app/compliance"] },
    { label: "Organization", routes: ["/app/organization", "/app/workspaces", "/app/teams"] },
    { label: "Documents & resources", routes: ["/app/evidence", "/app/people", "/app/assets", "/app/environment"] },
    { label: "Intelligence & governance", routes: ["/app/reports", "/app/audit"] },
  ].find((group) => group.routes.includes(route) || group.routes.some((href) => route.startsWith(`${href}/`)))
  const contextualItems = contextualGroups?.routes.filter((href) => href !== "/app/reviews" || canReviewAnyStage(role)).map((href) => modules.find((module) => module.href === href)).filter((module): module is (typeof modules)[number] => Boolean(module)) ?? []

  useEffect(() => {
    const savedRole = window.sessionStorage.getItem("sentriq-demo-role")
    if (savedRole && demoRoles.some((item) => item.value === savedRole)) setRole(savedRole as DemoRole)
    const savedLanguage = window.localStorage.getItem("sentriq-demo-language") ?? window.sessionStorage.getItem("sentriq-demo-language")
    if (savedLanguage === "en" || savedLanguage === "ar") {
      setLanguage(savedLanguage)
      document.documentElement.lang = savedLanguage
      document.documentElement.dir = savedLanguage === "ar" ? "rtl" : "ltr"
    }
  }, [])

  useEffect(() => {
    if (!profileOpen) return
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setProfileOpen(false); profileButtonRef.current?.focus() } }
    const onDown = (event: MouseEvent) => { if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false) }
    document.addEventListener("keydown", onKey); document.addEventListener("mousedown", onDown)
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown) }
  }, [profileOpen])

  useEffect(() => {
    if (!mobileOpen) return
    closeNavRef.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setMobileOpen(false); menuButtonRef.current?.focus() } }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [mobileOpen])

  useEffect(() => { setMobileOpen(false); setProfileOpen(false) }, [route])

  // Honest notification count: derived from the same records the screens use, never a fixed number.
  useEffect(() => {
    try {
      const me = demoActor(role).userId
      const stages = reviewStagesFor(role)
      const reviews = can(role, "inspections.read") ? inspectionRepository.list(workspaceId).filter((item) => ["submitted", "in_review"].includes(item.status) && item.currentStage && stages.includes(item.currentStage) && item.inspectorId !== me).length : 0
      const returned = can(role, "inspections.read") ? inspectionRepository.list(workspaceId).filter((item) => item.status === "returned" && item.inspectorId === me).length : 0
      const actions = can(role, "actions.read") ? actionRepository.list(workspaceId).filter((item) => (item.ownerId === me && isActionOverdue(item)) || (item.status === "closure_requested" && can(role, "actions.verify") && item.ownerId !== me)).length : 0
      setAttention(reviews + returned + actions)
    } catch { setAttention(0) }
  }, [role, workspaceId, route])

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && route === "/app/dashboard") {
        event.preventDefault(); searchRef.current?.focus()
      }
    }
    document.addEventListener("keydown", focusSearch)
    return () => document.removeEventListener("keydown", focusSearch)
  }, [route])

  const setLanguageAndPersist = (nextLanguage: Language) => {
    setLanguage(nextLanguage)
    window.localStorage.setItem("sentriq-demo-language", nextLanguage)
    window.sessionStorage.setItem("sentriq-demo-language", nextLanguage)
    document.documentElement.lang = nextLanguage
    document.documentElement.dir = nextLanguage === "ar" ? "rtl" : "ltr"
  }
  const changeRole = (nextRole: DemoRole) => { setRole(nextRole); window.sessionStorage.setItem("sentriq-demo-role", nextRole) }
  const dashboard = route === "/app/dashboard"

  return (
    <div className={`app-shell sq-shell${rtl ? " is-rtl" : ""}`} dir={rtl ? "rtl" : "ltr"}>
      <a className="skip-link" href="#main-content">{rtl ? "تخطَّ إلى المحتوى الرئيسي" : "Skip to main content"}</a>
      {mobileOpen && <button className="mobile-scrim" aria-label={t.close} onClick={() => setMobileOpen(false)} />}
      <aside id="primary-navigation" className={`sidebar${collapsed ? " sidebar-collapsed" : ""}${mobileOpen ? " sidebar-mobile-open" : ""}`}>
        <Link className="brand" href="/app/dashboard" aria-label="SENTRIQ home">
          <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M23.5 6.5H13.2a6.7 6.7 0 0 0 0 13.4h5.6a6.7 6.7 0 0 1 0 13.4H8.5" transform="translate(0 -3.9)" stroke="currentColor" strokeWidth="2.1" strokeLinecap="square"/><circle cx="24" cy="4.8" r="2.1" fill="#D46A43"/></svg></span>
          {!collapsed && <span className="brand-name">SENTRIQ<span className="brand-period">.</span></span>}
        </Link>
        {mobileOpen && <button type="button" ref={closeNavRef} className="sidebar-close" aria-label={t.close} onClick={() => { setMobileOpen(false); menuButtonRef.current?.focus() }}><X size={19} /></button>}
        {!collapsed && <div className="workspace-label">{t.workspace}</div>}
        <label className="workspace-select-wrap">
          <span className="workspace-icon"><Building2 size={17} /></span>
          {!collapsed && <select aria-label={t.workspace} value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}>
            <option value="ws_northstar">Northstar Facilities</option>
            <option value="ws_cedarline">Cedarline Manufacturing</option>
          </select>}
          {!collapsed && <ChevronDown className="select-chevron" size={14} />}
        </label>
        <nav className="side-nav" aria-label={rtl ? "التنقل الرئيسي" : "Main navigation"}>
          {navigation.map(({ label, ar, href, icon: Icon }, index) => {
            const active = route === href || (href !== "/app/dashboard" && route.startsWith(`${href}/`))
            const currentState = route === href ? "page" : href === "/app/modules" && selectedModule ? "location" : undefined
            return <div key={href}>{index === 2 && !collapsed && <div className="sq-nav-label">{rtl ? "عمليات QHSE" : "QHSE OPERATIONS"}</div>}<Link href={href} onClick={() => setMobileOpen(false)} className={`nav-link${active ? " nav-link-active" : ""}`} aria-current={currentState} title={collapsed ? (rtl ? ar : label) : undefined}>
              <Icon size={18} strokeWidth={1.8} /><span className="nav-link-text">{rtl ? ar : label}</span>
            </Link></div>
          })}
        </nav>
        <div className="sidebar-admin-separator" />
        <nav className="side-nav side-nav-admin" aria-label={rtl ? "إدارة المؤسسة" : "Administration"}>
          {administration.map(({ label, ar, href, icon: Icon }) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`nav-link${(href.startsWith("/app/admin") ? route.startsWith("/app/admin") : route === href) ? " nav-link-active" : ""}`} aria-current={(href.startsWith("/app/admin") ? route.startsWith("/app/admin") : route === href) ? "page" : undefined} title={collapsed ? (rtl ? ar : label) : undefined}><Icon size={18} strokeWidth={1.8} /><span className="nav-link-text">{rtl ? ar : label}</span></Link>)}
        </nav>
        <div className="sidebar-bottom sq-sidebar-bottom"><Link className={`nav-link${route === "/app/modules" ? " nav-link-active" : ""}`} href="/app/modules" onClick={() => setMobileOpen(false)} aria-current={route === "/app/modules" ? "page" : undefined} title={rtl ? "كل التطبيقات" : "All apps"}><Grid2X2 size={17} /><span className="nav-link-text">{rtl ? "كل التطبيقات" : "All apps"}</span></Link>{!collapsed && <div className="sidebar-version"><span>QHSE WORKSPACE</span><span>PREVIEW · SAMPLE DATA</span></div>}</div>
        <button className="collapse-button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? (rtl ? <ChevronLeft size={16} /> : <ChevronRight size={16} />) : (rtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />)}</button>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <button ref={menuButtonRef} type="button" className="mobile-menu-button" aria-label={t.menu} aria-expanded={mobileOpen} aria-controls="primary-navigation" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>{rtl ? "مساحة العمل" : "Workspace"}</span><ChevronRight size={14} /><strong>{rtl ? current.ar : current.label}</strong></div>
          <div className="topbar-actions">
            {dashboard && <div className="top-search"><Search size={16} /><input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={rtl ? "البحث في أعمال النظرة العامة" : "Search overview work..."} aria-label={rtl ? "البحث في أعمال النظرة العامة" : "Search overview work"} /><kbd>⌘ K</kbd></div>}
            <div className="topbar-divider" />
            <button type="button" className="language-button" onClick={() => setLanguageAndPersist(rtl ? "en" : "ar")} aria-label={rtl ? "Switch to English" : "التغيير إلى العربية"}><Languages size={16} /><span>{rtl ? "العربية" : "EN"}</span></button>
            <button type="button" className="icon-button notification-button" aria-label={rtl ? `الإشعارات، ${attention} تحتاج إلى انتباه` : `Notifications, ${attention} need attention`} title={rtl ? "الإشعارات" : "Notifications"}><Bell size={18} />{attention > 0 && <i />}</button>
            <div className="topbar-divider profile-divider" />
            <div className="role-picker"><span className="role-caption">{t.role}</span><select aria-label={t.role} value={role} onChange={(event) => changeRole(event.target.value as DemoRole)}>{demoRoles.map((item) => <option key={item.value} value={item.value}>{rtl ? item.ar : item.en}</option>)}</select><ChevronDown size={13} /></div>
            <div className="avatar-menu" ref={profileRef}>
              <button type="button" ref={profileButtonRef} className="avatar avatar-menu-trigger" aria-haspopup="dialog" aria-expanded={profileOpen} aria-controls="avatar-menu-panel" aria-label={rtl ? "الحساب والإعدادات" : "Account and settings"} onClick={() => setProfileOpen(!profileOpen)}>MH</button>
              {profileOpen && <div id="avatar-menu-panel" className="avatar-menu-panel" role="dialog" aria-label={rtl ? "الحساب والإعدادات" : "Account and settings"}>
                <div className="avatar-menu-head"><span className="avatar" aria-hidden="true">MH</span><div><strong>Mariam Hassan</strong><small>{rtl ? "حساب معاينة" : "Preview account"}</small></div></div>
                <label className="avatar-menu-field"><span>{t.role}</span><select aria-label={t.role} value={role} onChange={(event) => changeRole(event.target.value as DemoRole)}>{demoRoles.map((item) => <option key={item.value} value={item.value}>{rtl ? item.ar : item.en}</option>)}</select></label>
                <p className="avatar-menu-note">{t.simulation}</p>
                <div className="avatar-menu-field"><span>{rtl ? "اللغة" : "Language"}</span><div className="avatar-menu-lang" role="group" aria-label={rtl ? "اللغة" : "Language"}><button type="button" aria-pressed={!rtl} onClick={() => setLanguageAndPersist("en")}>English</button><button type="button" aria-pressed={rtl} onClick={() => setLanguageAndPersist("ar")}>العربية</button></div></div>
              </div>}
            </div>
          </div>
        </header>
        {contextualGroups ? <nav className="contextual-nav" aria-label={rtl ? "التنقل داخل الوحدة" : `${contextualGroups.label} navigation`}>
          <span>{rtl ? ({ Inspections: "التفتيشات", "Findings & actions": "الملاحظات والإجراءات", "Risk & compliance": "المخاطر والامتثال", Organization: "المؤسسة", "Documents & resources": "المستندات والموارد", "Intelligence & governance": "الذكاء والحوكمة" } as Record<string, string>)[contextualGroups.label] : contextualGroups.label}</span>{contextualItems.map((module) => { const active = route === module.href || route.startsWith(`${module.href}/`); return <Link key={module.href} href={module.href} className={active ? "is-active" : ""} aria-current={route === module.href ? "page" : undefined}>{rtl ? moduleArabic[module.name] : module.name}</Link>})}
        </nav> : null}
        <main className="main-content" id="main-content" tabIndex={-1}>
          {dashboard ? <OverviewDashboard data={data} language={language} search={search} role={role} workspaceId={workspaceId} /> : route === "/app/people" || route.startsWith("/app/people/") ? <PeopleDirectory route={route} workspaceId={workspaceId} role={role} language={language} sessionMembers={sessionMembers} sessionMembersLoaded={sessionMembersLoaded} onAddMember={addSessionMember} /> : route.startsWith("/app/admin") ? <AdminCenter route={route} role={role} language={language} /> : route === "/app/my-work" ? <MyWork data={data} role={role} language={language} /> : route === "/app/forms" ? <FormsLibrary language={language} /> : route === "/app/inspections" || route.startsWith("/app/inspections/") || route === "/app/reviews" || route.startsWith("/app/reviews/") ? <Inspections route={route} language={language} workspaceId={workspaceId} role={role} /> : route === "/app/actions" || route.startsWith("/app/actions/") ? <Actions route={route} language={language} workspaceId={workspaceId} role={role} /> : route === "/app/modules" ? <ModuleDirectory language={language} /> : selectedModule ? <ModuleLanding module={selectedModule} /> : <ComingSoon language={language} route={route} title={rtl ? current.ar : current.label} />}
        </main>
      </div>
    </div>
  )
}

const directoryCategories = ["All modules", "Enterprise", "Operations", "Risk & compliance", "Actions", "Resources", "Intelligence"]
const moduleCategory = (group: string) => group === "Enterprise foundation" ? "Enterprise" : group === "QHSE operations" ? "Operations" : group === "Risk & compliance" ? "Risk & compliance" : group === "Findings & actions" ? "Actions" : group === "Documents & resources" ? "Resources" : "Intelligence"
const moduleArabic: Record<string, string> = { "Organization & sites": "المؤسسة والمواقع", Workspaces: "مساحات العمل", "Users & teams": "المستخدمون والفرق", "Forms library": "مكتبة النماذج", "Inspection management": "إدارة التفتيش", "Incident management": "إدارة الحوادث", "Permit to work": "تصاريح العمل", "Risk assessments": "تقييمات المخاطر", "Audit & compliance": "التدقيق والامتثال", "Findings & corrective actions": "الملاحظات والإجراءات التصحيحية", "Documents & evidence": "المستندات والأدلة", "People & Workforce": "الأفراد والقوى العاملة", "Assets & equipment": "الأصول والمعدات", "Environmental records": "السجلات البيئية", "Reports & analytics": "التقارير والتحليلات", "Audit trail": "سجل التدقيق", "Review inbox": "صندوق المراجعة", "Follow-ups": "المتابعات" }
const moduleGroupArabic: Record<string, string> = { "Enterprise foundation": "أساس المؤسسة", "QHSE operations": "عمليات QHSE", "Risk & compliance": "المخاطر والامتثال", "Findings & actions": "الملاحظات والإجراءات", "Documents & resources": "المستندات والموارد", "Intelligence & governance": "الذكاء والحوكمة" }
const moduleStateArabic: Record<string, string> = { "Working prototype": "نموذج أولي عامل", Preview: "معاينة", Planned: "مخطط" }

function ModuleIcon({ module }: { module: string }) {
  const Icon = module.includes("Organization") ? Building2 : module.includes("Workspace") ? BriefcaseBusiness : module.includes("Users") || module.includes("People") ? UsersRound : module.includes("Form") ? ClipboardList : module.includes("Inspection") ? ClipboardCheck : module.includes("Review") ? FileCheck2 : module.includes("Incident") ? Siren : module.includes("Permit") ? ShieldCheck : module.includes("Risk") ? AlertTriangle : module.includes("Audit &") ? BookOpenCheck : module.includes("Finding") || module.includes("Follow") ? HardHat : module.includes("Documents") ? FolderOpen : module.includes("Assets") ? Factory : module.includes("Environmental") ? CircleDot : module.includes("Reports") ? ChartNoAxesCombined : ScrollText
  return <Icon size={17} strokeWidth={1.8} />
}

function ModuleDirectory({ language }: { language: Language }) {
  const [category, setCategory] = useState("All modules")
  const [query, setQuery] = useState("")
  const rtl = language === "ar"
  const categoryLabels = copy[language].categories
  const visibleModules = modules.filter((module) => (category === "All modules" || moduleCategory(module.group) === category) && `${module.name} ${rtl ? moduleArabic[module.name] : ""} ${module.group} ${module.purpose}`.toLowerCase().includes(query.toLowerCase()))
  return <section className="module-directory">
    <div className="module-page-heading"><p className="eyebrow">SENTRIQ / MODULE DIRECTORY</p><h1>{rtl ? "وحدات SENTRIQ" : "SENTRIQ Modules"}</h1><p>{rtl ? "استكشف القدرات التشغيلية المترابطة عبر مؤسستك." : "Explore the connected operational capabilities across your organization. Discover how each module supports a shared operational workflow."}</p></div>
    <div className="directory-toolbar"><div className="directory-filters" role="tablist" aria-label={rtl ? "تصفية الوحدات" : "Filter modules"}>{directoryCategories.map((item, index) => <button type="button" role="tab" aria-selected={category === item} className={category === item ? "is-active" : ""} key={item} onClick={() => setCategory(item)}>{categoryLabels[index]}</button>)}</div><label className="directory-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={rtl ? "البحث في الوحدات" : "Search the directory"} aria-label={rtl ? "البحث في الوحدات" : "Search the directory"} /></label></div>
    {directoryCategories.slice(1).map((group, index) => { const groupModules = visibleModules.filter((module) => moduleCategory(module.group) === group); if (!groupModules.length) return null; return <div className="directory-group" key={group}><div className="directory-group-heading"><h2>{category === "All modules" ? (rtl ? ["أساس المؤسسة", "عمليات QHSE", "المخاطر والامتثال", "الملاحظات والإجراءات", "المستندات والموارد", "الذكاء والحوكمة"][index] : group) : (rtl ? categoryLabels[index + 1] : group)}</h2><span>{groupModules.length.toString().padStart(2, "0")} MODULES</span></div><div className="directory-grid">{groupModules.map((module) => <Link className="directory-card" href={module.href} key={module.href}><div className="directory-card-top"><span className="directory-card-icon"><ModuleIcon module={module.name} /></span><span className={`implementation-state state-${module.state.toLowerCase().replaceAll(" ", "-")}`}>{rtl ? moduleStateArabic[module.state] : module.state}</span></div><h3>{rtl ? moduleArabic[module.name] : module.name}</h3><p>{module.purpose}</p><span className="directory-card-flow">{module.workflow}</span><span className="directory-related">{rtl ? "مرتبط بـ" : "Connects with"} · {module.links.slice(0, 3).join(" · ")}</span><span className="directory-open">{rtl ? "فتح الوحدة" : "Open module"}<ArrowRight size={14} /></span></Link>)}</div></div> })}
    {!visibleModules.length && <p className="directory-empty">{rtl ? "لا توجد وحدات مطابقة للبحث." : "No modules match your search."}</p>}
  </section>
}

function ModuleLanding({ module }: { module: (typeof modules)[number] }) {
  const connected = modules.filter((candidate) => module.links.includes(candidate.name) || module.links.some((label) => candidate.name.startsWith(label)))
  return <section className="module-landing">
    <div className="module-page-heading"><p className="eyebrow">{module.group.toUpperCase()} / SENTRIQ MODULE</p><div className="module-title-row"><h1>{module.name}</h1><span className={`implementation-state state-${module.state.toLowerCase().replaceAll(" ", "-")}`}>{module.state} experience</span></div><p>{module.purpose}</p></div>
    <div className="module-overview-grid"><article className="module-info-panel"><span className="module-info-label">WORKFLOW POSITION</span><h2>How this module connects</h2><div className="module-workflow">{module.workflow.split(" → ").map((step, index, steps) => <div className="module-workflow-step" key={`${step}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><strong>{step}</strong>{index < steps.length - 1 && <ArrowRight size={14}/>}</div>)}</div><p>This is the intended business relationship for the prototype. Records are preview concepts and are not persisted to a production service.</p></article><aside className="module-info-panel module-status-panel"><span className="module-info-label">IMPLEMENTATION STATUS</span><h2>{module.state} functionality</h2><p>{module.state === "Preview" ? "This module has a frontend preview experience. Sample information is illustrative and actions do not create backend records." : "This module is positioned in the ERP navigation and architecture. Its production workflow is planned and not yet available."}</p><Link className="module-back-link" href="/app/modules">Browse all modules <ArrowRight size={14}/></Link></aside></div>
    <div className="module-connected"><div className="directory-group-heading"><h2>Connected modules</h2><Link href="/app/modules">View directory <ArrowRight size={14}/></Link></div><div className="connected-module-list">{connected.map((item) => <Link href={item.href} key={item.href}><span>{item.group}</span><strong>{item.name}</strong><ArrowRight size={14}/></Link>)}</div></div>
  </section>
}

function ComingSoon({ language, route, title }: { language: Language; route: string; title?: string }) {
  const rtl = language === "ar"
  return <section className="coming-soon"><div className="coming-icon"><ClipboardList size={24} /></div><p className="eyebrow">{rtl ? "مساحة العمل" : "SENTRIQ WORKSPACE"}</p><h1>{title ?? route.split("/").filter(Boolean).at(-1)}</h1><p>{rtl ? "هذه الصفحة جزء من إصدار مستقبلي. التنقل جاهز، وسيتم تقديم الوظائف في المرحلة التالية." : "This area is part of a future release. Navigation is ready; workflow features will be introduced in the next phase."}</p><Link href="/app/dashboard" className="button-primary"><LayoutDashboard size={16} />{rtl ? "العودة إلى النظرة العامة" : "Back to overview"}</Link></section>
}
