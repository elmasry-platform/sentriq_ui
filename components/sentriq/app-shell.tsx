"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo, useState } from "react"
import {
  Activity, Bell, Building2, ChevronDown, ChevronLeft, ChevronRight,
  ClipboardCheck, ClipboardList, FileCheck2, FileText, Gauge,
  HardHat, LayoutDashboard, Menu, Search, Settings2, ShieldCheck,
  UsersRound, X, Languages, AlertTriangle, ArrowRight, BookOpenCheck, BriefcaseBusiness,
  ChartNoAxesCombined, CircleDot, ClipboardPenLine, Factory, FolderOpen,
  Network, ScrollText, Siren, Users, type LucideIcon,
} from "lucide-react"
import { demoRoles, mockSentriqDashboardService, type DemoRole } from "@/lib/sentriq/dashboard-service"
import { OverviewDashboard } from "@/components/sentriq/overview-dashboard"
import { FormsLibrary } from "@/components/sentriq/forms-library"

export type Language = "en" | "ar"

type NavigationItem = { label: string; ar: string; href: string; icon: LucideIcon; badge?: string }

const navigation: { section: string; sectionAr: string; items: NavigationItem[] }[] = [
  { section: "OVERVIEW", sectionAr: "نظرة عامة", items: [
    { label: "Executive dashboard", ar: "لوحة الإدارة", href: "/app/dashboard", icon: LayoutDashboard },
    { label: "Module directory", ar: "دليل الوحدات", href: "/app/modules", icon: Network },
  ]},
  { section: "ENTERPRISE FOUNDATION", sectionAr: "أساس المؤسسة", items: [
    { label: "Organization & sites", ar: "المؤسسة والمواقع", href: "/app/organization", icon: Building2 },
    { label: "Workspaces", ar: "مساحات العمل", href: "/app/workspaces", icon: BriefcaseBusiness },
    { label: "Users & teams", ar: "المستخدمون والفرق", href: "/app/teams", icon: Users },
  ]},
  { section: "QHSE OPERATIONS", sectionAr: "عمليات QHSE", items: [
    { label: "Inspections", ar: "التفتيشات", href: "/app/inspections", icon: ClipboardCheck },
    { label: "Forms library", ar: "مكتبة النماذج", href: "/app/forms", icon: ClipboardList },
    { label: "Review inbox", ar: "صندوق المراجعة", href: "/app/reviews", icon: FileCheck2, badge: "3" },
    { label: "Incidents & observations", ar: "الحوادث والملاحظات", href: "/app/incidents", icon: Siren },
    { label: "Permit to work", ar: "تصاريح العمل", href: "/app/permits", icon: ShieldCheck },
  ]},
  { section: "RISK & COMPLIANCE", sectionAr: "المخاطر والامتثال", items: [
    { label: "Risk assessments", ar: "تقييمات المخاطر", href: "/app/risks", icon: AlertTriangle },
    { label: "Audit & compliance", ar: "التدقيق والامتثال", href: "/app/compliance", icon: BookOpenCheck },
  ]},
  { section: "FINDINGS & ACTIONS", sectionAr: "الملاحظات والإجراءات", items: [
    { label: "Findings & actions", ar: "الملاحظات والإجراءات", href: "/app/actions", icon: HardHat },
    { label: "Follow-ups", ar: "المتابعات", href: "/app/follow-ups", icon: Activity },
  ]},
  { section: "DOCUMENTS & RESOURCES", sectionAr: "المستندات والموارد", items: [
    { label: "Documents & evidence", ar: "المستندات والأدلة", href: "/app/evidence", icon: FolderOpen },
    { label: "People & competency", ar: "الأفراد والكفاءة", href: "/app/people", icon: UsersRound },
    { label: "Assets & equipment", ar: "الأصول والمعدات", href: "/app/assets", icon: Factory },
    { label: "Environmental records", ar: "السجلات البيئية", href: "/app/environment", icon: CircleDot },
  ]},
  { section: "INTELLIGENCE & GOVERNANCE", sectionAr: "الذكاء والحوكمة", items: [
    { label: "Reports & analytics", ar: "التقارير والتحليلات", href: "/app/reports", icon: ChartNoAxesCombined },
    { label: "Audit trail", ar: "سجل التدقيق", href: "/app/audit", icon: ScrollText },
  ]},
  { section: "ADMINISTRATION", sectionAr: "الإدارة", items: [
    { label: "Organization settings", ar: "إعدادات المؤسسة", href: "/app/admin/workspace", icon: Settings2 },
    { label: "Users & roles", ar: "المستخدمون والأدوار", href: "/app/admin/users", icon: UsersRound },
  ]},
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
]


const copy = {
  en: { workspace: "Workspace", search: "Search anything...", searchLabel: "Search workspace", role: "DEMO ROLE", simulation: "Simulated role — not real access control", today: "Today", menu: "Open navigation", close: "Close navigation", home: "Home" },
  ar: { workspace: "مساحة العمل", search: "ابحث في مساحة العمل...", searchLabel: "البحث في مساحة العمل", role: "الدور التجريبي", simulation: "دور تجريبي — لا يمثل صلاحيات حقيقية", today: "اليوم", menu: "فتح القائمة", close: "إغلاق القائمة", home: "الرئيسية" },
}

export function AppShell({ route }: { route: string }) {
  const [language, setLanguage] = useState<Language>("en")
  const [workspaceId, setWorkspaceId] = useState("ws_northstar")
  const [role, setRole] = useState<DemoRole>("tenant_admin")
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [search, setSearch] = useState("")
  const t = copy[language]
  const rtl = language === "ar"
  const data = useMemo(() => mockSentriqDashboardService.getDashboard(workspaceId), [workspaceId])
  const current = navigation.flatMap((group) => group.items).find((item) => route === item.href || route.startsWith(`${item.href}/`))
  const dashboard = route === "/app/dashboard"
  const selectedModule = modules.find((module) => module.href === route)

  return (
    <div className={`app-shell${rtl ? " is-rtl" : ""}`} dir={rtl ? "rtl" : "ltr"}>
      {mobileOpen && <button className="mobile-scrim" aria-label={t.close} onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar${collapsed ? " sidebar-collapsed" : ""}${mobileOpen ? " sidebar-mobile-open" : ""}`}>
        <Link className="brand" href="/app/dashboard" aria-label="SENTRIQ home">
          <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M23.5 6.5H13.2a6.7 6.7 0 0 0 0 13.4h5.6a6.7 6.7 0 0 1 0 13.4H8.5" transform="translate(0 -3.9)" stroke="currentColor" strokeWidth="2.1" strokeLinecap="square"/><circle cx="24" cy="4.8" r="2.1" fill="#D46A43"/></svg></span>
          {!collapsed && <span className="brand-name">SENTRIQ<span className="brand-period">.</span></span>}
          {mobileOpen && <button type="button" className="sidebar-close" aria-label={t.close} onClick={(event) => { event.preventDefault(); setMobileOpen(false) }}><X size={19} /></button>}
        </Link>
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
          {navigation.map((group) => {
            const visibleItems = group.items.filter(({ label, ar }) => !search || `${label} ${ar}`.toLowerCase().includes(search.toLowerCase()))
            if (!visibleItems.length) return null
            const groupActive = visibleItems.some(({ href }) => route === href || (href !== "/app/dashboard" && route.startsWith(`${href}/`)))
            return <details className="nav-group" key={group.section} open={group.section === "OVERVIEW" || groupActive || Boolean(search)}>
              {!collapsed && <summary className="nav-section-label">{rtl ? group.sectionAr : group.section}<ChevronDown size={12} /></summary>}
              {visibleItems.map(({ label, ar, href, icon: Icon, badge }) => {
                const active = route === href || (href !== "/app/dashboard" && route.startsWith(`${href}/`))
                return <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`nav-link${active ? " nav-link-active" : ""}`} aria-current={active ? "page" : undefined} title={collapsed ? (rtl ? ar : label) : undefined}>
                  <Icon size={18} strokeWidth={1.8} /><span className="nav-link-text">{rtl ? ar : label}</span>{badge && !collapsed && <span className="nav-count">{badge}</span>}
                </Link>
              })}
            </details>
          })}
        </nav>
        {!collapsed && <div className="sidebar-bottom"><div className="support-card"><div className="support-icon"><ShieldCheck size={17} /></div><strong>{rtl ? "سلامة مؤسستك" : "Your safety, in sync."}</strong><span>{rtl ? "إدارة الجودة والصحة والسلامة في مكان واحد." : "QHSE workflows, all in one place."}</span></div><div className="sidebar-version">SENTRIQ WORKSPACE <span>v1.0.0 · DEMO</span></div></div>}
        <button className="collapse-button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? (rtl ? <ChevronLeft size={16} /> : <ChevronRight size={16} />) : (rtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />)}</button>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <button className="mobile-menu-button" aria-label={t.menu} onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>{rtl ? "مساحة العمل" : "Workspace"}</span><ChevronRight size={14} /><strong>{rtl ? current?.ar : current?.label}</strong></div>
          <div className="topbar-actions">
            <div className="top-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.search} aria-label={t.searchLabel} /><kbd>⌘ K</kbd></div>
            <div className="topbar-divider" />
            <button className="language-button" onClick={() => { const nextLanguage = rtl ? "en" : "ar"; setLanguage(nextLanguage); document.documentElement.lang = nextLanguage; document.documentElement.dir = nextLanguage === "ar" ? "rtl" : "ltr" }} aria-label={rtl ? "Switch to English" : "التغيير إلى العربية"}><Languages size={16} /><span>{rtl ? "العربية" : "EN"}</span></button>
            <button className="icon-button notification-button" aria-label={rtl ? "الإشعارات، 3 غير مقروءة" : "Notifications, 3 unread"}><Bell size={18} /><i /></button>
            <div className="topbar-divider profile-divider" />
            <div className="role-picker"><span className="role-caption">{t.role}</span><select aria-label={t.role} value={role} onChange={(event) => setRole(event.target.value as DemoRole)}>{demoRoles.map((item) => <option key={item.value} value={item.value}>{rtl ? item.ar : item.en}</option>)}</select><ChevronDown size={13} /></div>
            <div className="avatar" aria-label="Mariam Hassan">MH</div>
          </div>
        </header>
        <main className="main-content">
          {dashboard ? <OverviewDashboard data={data} language={language} search={search} /> : route === "/app/forms" ? <FormsLibrary language={language} /> : route === "/app/modules" ? <ModuleDirectory /> : selectedModule ? <ModuleLanding module={selectedModule} /> : <ComingSoon language={language} route={route} title={rtl ? current?.ar : current?.label} />}
        </main>
      </div>
    </div>
  )
}

function ModuleDirectory() {
  const groups = [...new Set(modules.map((module) => module.group))]
  return <section className="module-directory">
    <div className="module-page-heading"><p className="eyebrow">SENTRIQ ERP / MODULE DIRECTORY</p><h1>Connected QHSE modules</h1><p>Explore the business areas that make up the SENTRIQ operating system. Demonstration areas show frontend concepts; planned areas are clearly marked.</p></div>
    {groups.map((group) => <div className="directory-group" key={group}><div className="directory-group-heading"><h2>{group}</h2><span>{modules.filter((module) => module.group === group).length.toString().padStart(2, "0")} MODULES</span></div><div className="directory-grid">{modules.filter((module) => module.group === group).map((module) => <Link className="directory-card" href={module.href} key={module.href}><div className="directory-card-top"><span className={`implementation-state state-${module.state.toLowerCase().replaceAll(" ", "-")}`}>{module.state}</span><ArrowRight size={15}/></div><h3>{module.name}</h3><p>{module.purpose}</p><span className="directory-card-flow">{module.workflow}</span></Link>)}</div></div>)}
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
