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
import { FormsLibrary } from "@/components/sentriq/forms-library"
import { MyWork } from "@/components/sentriq/my-work"
import { AdminCenter } from "@/components/sentriq/admin-center"
import { Inspections } from "@/components/sentriq/inspections"

export type Language = "en" | "ar"

type NavigationItem = { label: string; ar: string; href: string; icon: LucideIcon; badge?: string }

const navigation: NavigationItem[] = [
  { label: "Overview", ar: "نظرة عامة", href: "/app/dashboard", icon: LayoutDashboard },
  { label: "My Work", ar: "مساحة عملي", href: "/app/my-work", icon: ListChecks },
  { label: "Modules", ar: "الوحدات", href: "/app/modules", icon: Network },
  { label: "Reports", ar: "التقارير", href: "/app/reports", icon: ChartNoAxesCombined },
]
const administration: NavigationItem[] = [
  { label: "Administration", ar: "الإدارة", href: "/app/admin/workspace", icon: Settings2 },
]

const modules = [
  { href: "/app/organization", name: "Organization & sites", group: "Enterprise foundation", state: "Planned", purpose: "A shared foundation for organizations, workspaces, operating locations, teams, and access boundaries.", workflow: "Organization → Workspace → Site → Team → Operational record", links: ["Workspaces", "Users & teams", "Inspections"] },
  { href: "/app/workspaces", name: "Workspaces", group: "Enterprise foundation", state: "Planned", purpose: "Separate operating contexts while keeping enterprise oversight connected.", workflow: "Organization → Workspace → Sites → Records", links: ["Organization & sites", "Users & teams"] },
  { href: "/app/teams", name: "Users & teams", group: "Enterprise foundation", state: "Planned", purpose: "Organize people and responsibilities around sites and operational workflows.", workflow: "Workspace → Team → Owner → Assigned action", links: ["Organization & sites", "Findings & actions"] },
  { href: "/app/forms", name: "Forms library", group: "QHSE operations", state: "Working prototype", purpose: "Create and manage reusable inspection form templates, with an existing form builder foundation.", workflow: "Draft form → Validate → Publish version → Use in inspection", links: ["Inspections", "Review inbox"] },
  { href: "/app/inspections", name: "Inspection management", group: "QHSE operations", state: "Demonstration", purpose: "Plan and review field inspections using reusable forms and a connected follow-through path.", workflow: "Form template → Inspection → Finding → Corrective action", links: ["Forms library", "Review inbox", "Findings & actions"] },
  { href: "/app/incidents", name: "Incident management", group: "QHSE operations", state: "Demonstration", purpose: "Structure incident and near-miss information for investigation, risk review, and follow-up.", workflow: "Incident → Investigation → Risk review → Action → Closure", links: ["Risk assessments", "Findings & actions", "Documents & evidence"] },
  { href: "/app/permits", name: "Permit to work", group: "QHSE operations", state: "Planned", purpose: "Provide a controlled home for work authorization and operational precautions.", workflow: "Request → Hazard review → Authorization → Closeout", links: ["Risk assessments", "Users & teams"] },
  { href: "/app/risks", name: "Risk assessments", group: "Risk & compliance", state: "Demonstration", purpose: "Connect hazards, controls, assigned actions, and residual risk monitoring.", workflow: "Hazard → Assessment → Controls → Residual risk", links: ["Incidents & observations", "Findings & actions"] },
  { href: "/app/compliance", name: "Audit & compliance", group: "Risk & compliance", state: "Demonstration", purpose: "Organize audits and compliance obligations around observations and accountable actions.", workflow: "Audit → Observation → Non-conformity → Action → Verification", links: ["Forms library", "Findings & actions", "Documents & evidence"] },
  { href: "/app/actions", name: "Findings & corrective actions", group: "Findings & actions", state: "Demonstration", purpose: "Turn operational issues into owned, time-bound actions with evidence, review, and closure.", workflow: "Finding → Assignment → Correction → Verification → Closure", links: ["Inspections", "Incidents & observations", "Audit & compliance"] },
  { href: "/app/evidence", name: "Documents & evidence", group: "Documents & resources", state: "Demonstration", purpose: "Keep supporting evidence visible alongside the inspections, risks, and actions it relates to.", workflow: "Record → Evidence → Review → Retention", links: ["Findings & actions", "Inspections", "Audit & compliance"] },
  { href: "/app/people", name: "People & competency", group: "Documents & resources", state: "Planned", purpose: "Provide a future home for training, qualifications, and workforce readiness.", workflow: "Role → Competency → Training → Verification", links: ["Users & teams", "Reports & analytics"] },
  { href: "/app/assets", name: "Assets & equipment", group: "Documents & resources", state: "Planned", purpose: "Connect equipment identity, inspections, condition, and maintenance follow-up.", workflow: "Asset → Inspection → Defect → Maintenance action", links: ["Inspections", "Findings & actions"] },
  { href: "/app/environment", name: "Environmental records", group: "Documents & resources", state: "Planned", purpose: "A coherent place for environmental monitoring and operational records.", workflow: "Measure → Record → Review → Report", links: ["Documents & evidence", "Reports & analytics"] },
  { href: "/app/reports", name: "Reports & analytics", group: "Intelligence & governance", state: "Demonstration", purpose: "Give managers an aggregated view of operational activity and areas needing attention.", workflow: "Operational records → Trends → Management review", links: ["Inspections", "Findings & actions", "Audit & compliance"] },
  { href: "/app/audit", name: "Audit trail", group: "Intelligence & governance", state: "Planned", purpose: "A future traceable history of important record and workflow events.", workflow: "Event → Actor → Record → Review", links: ["Users & teams", "Reports & analytics"] },
  { href: "/app/reviews", name: "Review inbox", group: "QHSE operations", state: "Demonstration", purpose: "Bring pending submissions and review decisions into one focused queue.", workflow: "Submission → Review → Return or approve", links: ["Forms library", "Inspection management", "Findings & corrective actions"] },
  { href: "/app/follow-ups", name: "Follow-ups", group: "Findings & actions", state: "Demonstration", purpose: "Track the next steps connected to findings, reviews, and assigned actions.", workflow: "Assignment → Follow-up → Verification", links: ["Findings & corrective actions", "Review inbox"] },
]


const copy = {
  en: { workspace: "Workspace", search: "Search anything...", searchLabel: "Search workspace", role: "DEMO ROLE", simulation: "Simulated role — not real access control", today: "Today", menu: "Open navigation", close: "Close navigation", home: "Home", modules: "Modules", directory: "View all modules", searchModules: "Search modules", noModules: "No modules match your search", categories: ["All modules", "Enterprise", "Operations", "Risk & compliance", "Actions", "Resources", "Intelligence"] },
  ar: { workspace: "مساحة العمل", search: "ابحث في مساحة العمل...", searchLabel: "البحث في مساحة العمل", role: "الدور التجريبي", simulation: "دور تجريبي — لا يمثل صلاحيات حقيقية", today: "اليوم", menu: "فتح القائمة", close: "إغلاق القائمة", home: "الرئيسية", modules: "الوحدات", directory: "عرض جميع الوحدات", searchModules: "البحث عن وحدة", noModules: "لا توجد وحدات مطابقة", categories: ["كل الوحدات", "المؤسسة", "العمليات", "المخاطر والامتثال", "الإجراءات", "الموارد", "الذكاء"] },
}

export function AppShell({ route }: { route: string }) {
  const [language, setLanguage] = useState<Language>("en")
  const [workspaceId, setWorkspaceId] = useState("ws_northstar")
  const [role, setRole] = useState<DemoRole>("company_superadmin")
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [search, setSearch] = useState("")
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [moduleSearch, setModuleSearch] = useState("")
  const switcherRef = useRef<HTMLDivElement>(null)
  const t = copy[language]
  const rtl = language === "ar"
  const data = useMemo(() => mockSentriqDashboardService.getDashboard(workspaceId), [workspaceId])
  const selectedModule = modules.find((module) => module.href === route || (module.href === "/app/inspections" && route.startsWith("/app/inspections/")))
  const current = navigation.find((item) => route === item.href || route.startsWith(`${item.href}/`)) ?? (selectedModule ? { label: selectedModule.name, ar: moduleArabic[selectedModule.name], href: selectedModule.href, icon: Network } : route.startsWith("/app/admin") ? administration[0] : { label: "My Work", ar: "مساحة عملي", href: "/app/actions", icon: ListChecks })
  const contextualGroups = [
    { label: "Inspections", routes: ["/app/inspections", "/app/forms", "/app/reviews"] },
    { label: "Findings & actions", routes: ["/app/actions", "/app/follow-ups"] },
    { label: "Risk & compliance", routes: ["/app/risks", "/app/compliance"] },
    { label: "Organization", routes: ["/app/organization", "/app/workspaces", "/app/teams"] },
    { label: "Documents & resources", routes: ["/app/evidence", "/app/people", "/app/assets", "/app/environment"] },
    { label: "Intelligence & governance", routes: ["/app/reports", "/app/audit"] },
  ].find((group) => group.routes.includes(route) || group.routes.some((href) => route.startsWith(`${href}/`)))
  const contextualItems = contextualGroups?.routes.map((href) => modules.find((module) => module.href === href)).filter((module): module is (typeof modules)[number] => Boolean(module)) ?? []

  useEffect(() => {
    const savedRole = window.sessionStorage.getItem("sentriq-demo-role")
    if (savedRole && demoRoles.some((item) => item.value === savedRole)) setRole(savedRole as DemoRole)
    const savedLanguage = window.sessionStorage.getItem("sentriq-demo-language")
    if (savedLanguage === "en" || savedLanguage === "ar") {
      setLanguage(savedLanguage)
      document.documentElement.lang = savedLanguage
      document.documentElement.dir = savedLanguage === "ar" ? "rtl" : "ltr"
    }
  }, [])

  useEffect(() => {
    if (!switcherOpen) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setSwitcherOpen(false) }
    const closeOnOutsideClick = (event: MouseEvent) => { if (!switcherRef.current?.contains(event.target as Node)) setSwitcherOpen(false) }
    document.addEventListener("keydown", closeOnEscape)
    document.addEventListener("mousedown", closeOnOutsideClick)
    return () => { document.removeEventListener("keydown", closeOnEscape); document.removeEventListener("mousedown", closeOnOutsideClick) }
  }, [switcherOpen])

  const dashboard = route === "/app/dashboard"

  return (
    <div className={`app-shell${rtl ? " is-rtl" : ""}`} dir={rtl ? "rtl" : "ltr"}>
      {mobileOpen && <button className="mobile-scrim" aria-label={t.close} onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar${collapsed ? " sidebar-collapsed" : ""}${mobileOpen ? " sidebar-mobile-open" : ""}`}>
        <Link className="brand" href="/app/dashboard" aria-label="SENTRIQ home">
          <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M23.5 6.5H13.2a6.7 6.7 0 0 0 0 13.4h5.6a6.7 6.7 0 0 1 0 13.4H8.5" transform="translate(0 -3.9)" stroke="currentColor" strokeWidth="2.1" strokeLinecap="square"/><circle cx="24" cy="4.8" r="2.1" fill="#D46A43"/></svg></span>
          {!collapsed && <span className="brand-name">SENTRIQ<span className="brand-period">.</span></span>}
        </Link>
        {mobileOpen && <button type="button" className="sidebar-close" aria-label={t.close} onClick={() => setMobileOpen(false)}><X size={19} /></button>}
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
          {navigation.map(({ label, ar, href, icon: Icon }) => {
            const active = route === href || (href !== "/app/dashboard" && route.startsWith(`${href}/`))
            return <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`nav-link${active ? " nav-link-active" : ""}`} aria-current={active ? "page" : undefined} title={collapsed ? (rtl ? ar : label) : undefined}>
              <Icon size={18} strokeWidth={1.8} /><span className="nav-link-text">{rtl ? ar : label}</span>
            </Link>
          })}
        </nav>
        <div className="sidebar-admin-separator" />
        <nav className="side-nav side-nav-admin" aria-label={rtl ? "إدارة المؤسسة" : "Administration"}>
          {administration.map(({ label, ar, href, icon: Icon }) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`nav-link${route.startsWith("/app/admin") ? " nav-link-active" : ""}`} aria-current={route.startsWith("/app/admin") ? "page" : undefined} title={collapsed ? (rtl ? ar : label) : undefined}><Icon size={18} strokeWidth={1.8} /><span className="nav-link-text">{rtl ? ar : label}</span></Link>)}
        </nav>
        {!collapsed && <div className="sidebar-bottom"><div className="support-card"><div className="support-icon"><ShieldCheck size={17} /></div><strong>{rtl ? "سلامة مؤسستك" : "Your safety, in sync."}</strong><span>{rtl ? "إدارة الجودة والصحة والسلامة في مكان واحد." : "QHSE workflows, all in one place."}</span></div><div className="sidebar-version">SENTRIQ WORKSPACE <span>v1.0.0 · DEMO</span></div></div>}
        <button className="collapse-button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? (rtl ? <ChevronLeft size={16} /> : <ChevronRight size={16} />) : (rtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />)}</button>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <button className="mobile-menu-button" aria-label={t.menu} onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>{rtl ? "مساحة العمل" : "Workspace"}</span><ChevronRight size={14} /><strong>{rtl ? current.ar : current.label}</strong></div>
          <div className="topbar-actions">
            <div className="module-switcher" ref={switcherRef}>
              <button className={`module-switcher-trigger${switcherOpen ? " is-open" : ""}`} onClick={() => setSwitcherOpen(!switcherOpen)} aria-expanded={switcherOpen} aria-haspopup="dialog"><Grid2X2 size={16} /><span>{t.modules}</span><ChevronDown size={13} /></button>
              {switcherOpen && <div className="module-switcher-panel" role="dialog" aria-label={t.modules}>
                <div className="switcher-heading"><div><span>{rtl ? "مساحة العمل" : "WORKSPACE"}</span><strong>{t.modules}</strong></div><button type="button" aria-label={t.close} onClick={() => setSwitcherOpen(false)}><X size={16} /></button></div>
                <label className="switcher-search"><Search size={15} /><input autoFocus value={moduleSearch} onChange={(event) => setModuleSearch(event.target.value)} placeholder={t.searchModules} aria-label={t.searchModules} /></label>
                <div className="switcher-quick-access"><span><Star size={12} />{rtl ? "الوصول السريع" : "QUICK ACCESS"}</span>{modules.filter((module) => ["/app/inspections", "/app/risks", "/app/actions"].includes(module.href)).map((module) => <Link href={module.href} key={module.href} onClick={() => setSwitcherOpen(false)}>{rtl ? moduleArabic[module.name] : module.name}</Link>)}</div>
                <div className="switcher-modules">{[...new Set(modules.map((module) => module.group))].map((group) => { const groupModules = modules.filter((module) => module.group === group && `${module.name} ${rtl ? moduleArabic[module.name] : ""} ${module.group} ${rtl ? moduleGroupArabic[module.group] : ""} ${module.purpose}`.toLowerCase().includes(moduleSearch.toLowerCase())); return groupModules.length ? <section className="switcher-module-group" key={group}><h3>{rtl ? moduleGroupArabic[group] : group}</h3>{groupModules.slice(0, 4).map((module) => <Link href={module.href} key={module.href} onClick={() => setSwitcherOpen(false)}><span className="switcher-module-icon"><ModuleIcon module={module.name} /></span><span><strong>{rtl ? moduleArabic[module.name] : module.name}</strong><small>{rtl ? moduleStateArabic[module.state] : module.state} · {rtl ? moduleGroupArabic[module.group] : module.group}</small></span><ArrowRight size={14} /></Link>)}</section> : null})}</div>
                <Link className="switcher-directory-link" href="/app/modules" onClick={() => setSwitcherOpen(false)}>{t.directory}<ArrowRight size={14} /></Link>
              </div>}
            </div>
            <div className="top-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.search} aria-label={t.searchLabel} /><kbd>⌘ K</kbd></div>
            <div className="topbar-divider" />
            <button className="language-button" onClick={() => { const nextLanguage = rtl ? "en" : "ar"; setLanguage(nextLanguage); window.sessionStorage.setItem("sentriq-demo-language", nextLanguage); document.documentElement.lang = nextLanguage; document.documentElement.dir = nextLanguage === "ar" ? "rtl" : "ltr" }} aria-label={rtl ? "Switch to English" : "التغيير إلى العربية"}><Languages size={16} /><span>{rtl ? "العربية" : "EN"}</span></button>
            <button className="icon-button notification-button" aria-label={rtl ? "الإشعارات، 3 غير مقروءة" : "Notifications, 3 unread"}><Bell size={18} /><i /></button>
            <div className="topbar-divider profile-divider" />
            <div className="role-picker"><span className="role-caption">{t.role}</span><select aria-label={t.role} value={role} onChange={(event) => { const nextRole = event.target.value as DemoRole; setRole(nextRole); window.sessionStorage.setItem("sentriq-demo-role", nextRole) }}>{demoRoles.map((item) => <option key={item.value} value={item.value}>{rtl ? item.ar : item.en}</option>)}</select><ChevronDown size={13} /></div>
            <div className="avatar" aria-label="Mariam Hassan">MH</div>
          </div>
        </header>
        {contextualGroups ? <nav className="contextual-nav" aria-label={rtl ? "التنقل داخل الوحدة" : `${contextualGroups.label} navigation`}>
          <span>{rtl ? ({ Inspections: "التفتيشات", "Findings & actions": "الملاحظات والإجراءات", "Risk & compliance": "المخاطر والامتثال", Organization: "المؤسسة", "Documents & resources": "المستندات والموارد", "Intelligence & governance": "الذكاء والحوكمة" } as Record<string, string>)[contextualGroups.label] : contextualGroups.label}</span>{contextualItems.map((module) => <Link key={module.href} href={module.href} className={route === module.href || (module.href === "/app/inspections" && route.startsWith("/app/inspections/")) ? "is-active" : ""} aria-current={route === module.href ? "page" : undefined}>{rtl ? moduleArabic[module.name] : module.name}</Link>)}
        </nav> : null}
        <main className="main-content">
          {dashboard ? <OverviewDashboard data={data} language={language} search={search} /> : route.startsWith("/app/admin") ? <AdminCenter route={route} role={role} language={language} /> : route === "/app/my-work" ? <MyWork data={data} role={role} language={language} /> : route === "/app/forms" ? <FormsLibrary language={language} /> : route === "/app/inspections" || route.startsWith("/app/inspections/") || route === "/app/reviews" ? <Inspections route={route} language={language} workspaceId={workspaceId} role={role} /> : route === "/app/modules" ? <ModuleDirectory language={language} /> : selectedModule ? <ModuleLanding module={selectedModule} /> : <ComingSoon language={language} route={route} title={rtl ? current.ar : current.label} />}
        </main>
      </div>
    </div>
  )
}

const directoryCategories = ["All modules", "Enterprise", "Operations", "Risk & compliance", "Actions", "Resources", "Intelligence"]
const moduleCategory = (group: string) => group === "Enterprise foundation" ? "Enterprise" : group === "QHSE operations" ? "Operations" : group === "Risk & compliance" ? "Risk & compliance" : group === "Findings & actions" ? "Actions" : group === "Documents & resources" ? "Resources" : "Intelligence"
const moduleArabic: Record<string, string> = { "Organization & sites": "المؤسسة والمواقع", Workspaces: "مساحات العمل", "Users & teams": "المستخدمون والفرق", "Forms library": "مكتبة النماذج", "Inspection management": "إدارة التفتيش", "Incident management": "إدارة الحوادث", "Permit to work": "تصاريح العمل", "Risk assessments": "تقييمات المخاطر", "Audit & compliance": "التدقيق والامتثال", "Findings & corrective actions": "الملاحظات والإجراءات التصحيحية", "Documents & evidence": "المستندات والأدلة", "People & competency": "الأفراد والكفاءة", "Assets & equipment": "الأصول والمعدات", "Environmental records": "السجلات البيئية", "Reports & analytics": "التقارير والتحليلات", "Audit trail": "سجل التدقيق", "Review inbox": "صندوق المراجعة", "Follow-ups": "المتابعات" }
const moduleGroupArabic: Record<string, string> = { "Enterprise foundation": "أساس المؤسسة", "QHSE operations": "عمليات QHSE", "Risk & compliance": "المخاطر والامتثال", "Findings & actions": "الملاحظات والإجراءات", "Documents & resources": "المستندات والموارد", "Intelligence & governance": "الذكاء والحوكمة" }
const moduleStateArabic: Record<string, string> = { "Working prototype": "نموذج أولي عامل", Demonstration: "عرض توضيحي", Planned: "مخطط" }

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
    <div className="module-overview-grid"><article className="module-info-panel"><span className="module-info-label">WORKFLOW POSITION</span><h2>How this module connects</h2><div className="module-workflow">{module.workflow.split(" → ").map((step, index, steps) => <div className="module-workflow-step" key={`${step}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><strong>{step}</strong>{index < steps.length - 1 && <ArrowRight size={14}/>}</div>)}</div><p>This is the intended business relationship for the prototype. Records are demonstration concepts and are not persisted to a production service.</p></article><aside className="module-info-panel module-status-panel"><span className="module-info-label">IMPLEMENTATION STATUS</span><h2>{module.state} functionality</h2><p>{module.state === "Demonstration" ? "This module has a frontend demonstration experience. Sample information is illustrative and actions do not create backend records." : "This module is positioned in the ERP navigation and architecture. Its production workflow is planned and not yet available."}</p><Link className="module-back-link" href="/app/modules">Browse all modules <ArrowRight size={14}/></Link></aside></div>
    <div className="module-connected"><div className="directory-group-heading"><h2>Connected modules</h2><Link href="/app/modules">View directory <ArrowRight size={14}/></Link></div><div className="connected-module-list">{connected.map((item) => <Link href={item.href} key={item.href}><span>{item.group}</span><strong>{item.name}</strong><ArrowRight size={14}/></Link>)}</div></div>
  </section>
}

function ComingSoon({ language, route, title }: { language: Language; route: string; title?: string }) {
  const rtl = language === "ar"
  return <section className="coming-soon"><div className="coming-icon"><ClipboardList size={24} /></div><p className="eyebrow">{rtl ? "مساحة العمل" : "SENTRIQ WORKSPACE"}</p><h1>{title ?? route.split("/").filter(Boolean).at(-1)}</h1><p>{rtl ? "هذه الصفحة جزء من إصدار مستقبلي. التنقل جاهز، وسيتم تقديم الوظائف في المرحلة التالية." : "This area is part of a future release. Navigation is ready; workflow features will be introduced in the next phase."}</p><Link href="/app/dashboard" className="button-primary"><LayoutDashboard size={16} />{rtl ? "العودة إلى النظرة العامة" : "Back to overview"}</Link></section>
}
