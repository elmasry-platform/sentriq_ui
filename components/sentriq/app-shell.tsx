"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo, useState } from "react"
import {
  Activity, Bell, Building2, ChevronDown, ChevronLeft, ChevronRight,
  ClipboardCheck, ClipboardList, FileCheck2, FileText, Gauge,
  HardHat, LayoutDashboard, Menu, Search, Settings2, ShieldCheck,
  UsersRound, X, Languages,
} from "lucide-react"
import { demoRoles, mockSentriqDashboardService, type DemoRole } from "@/lib/sentriq/dashboard-service"
import { OverviewDashboard } from "@/components/sentriq/overview-dashboard"
import { FormsLibrary } from "@/components/sentriq/forms-library"

export type Language = "en" | "ar"

const navigation = [
  { section: "WORKSPACE", sectionAr: "مساحة العمل", items: [
    { label: "Overview", ar: "نظرة عامة", href: "/app/dashboard", icon: LayoutDashboard },
    { label: "Inspections", ar: "التفتيشات", href: "/app/inspections", icon: ClipboardCheck },
    { label: "Review inbox", ar: "صندوق المراجعة", href: "/app/reviews", icon: FileCheck2, badge: "3" },
    { label: "Forms library", ar: "مكتبة النماذج", href: "/app/forms", icon: ClipboardList },
  ]},
  { section: "FOLLOW-UP", sectionAr: "المتابعة", items: [
    { label: "Findings & actions", ar: "الملاحظات والإجراءات", href: "/app/actions", icon: HardHat },
    { label: "Follow-ups", ar: "المتابعات", href: "/app/follow-ups", icon: Activity },
    { label: "Evidence", ar: "الأدلة", href: "/app/evidence", icon: FileText },
  ]},
  { section: "INSIGHTS", sectionAr: "الرؤى", items: [
    { label: "Reports", ar: "التقارير", href: "/app/reports", icon: Gauge },
    { label: "Audit activity", ar: "سجل التدقيق", href: "/app/audit", icon: ShieldCheck },
  ]},
  { section: "MANAGE", sectionAr: "الإدارة", items: [
    { label: "Administration", ar: "الإدارة", href: "/app/admin/workspace", icon: Settings2 },
    { label: "Users & roles", ar: "المستخدمون والأدوار", href: "/app/admin/users", icon: UsersRound },
  ]},
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
  const current = navigation.flatMap((group) => group.items).find((item) => item.href === route)
  const dashboard = route === "/app/dashboard"

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
          {navigation.map((group) => <div className="nav-group" key={group.section}>
            {!collapsed && <div className="nav-section-label">{rtl ? group.sectionAr : group.section}</div>}
            {group.items.map(({ label, ar, href, icon: Icon, badge }) => {
              const active = route === href || (href === "/app/actions" && route.startsWith("/app/actions/")) || (href === "/app/inspections" && route.startsWith("/app/inspections/"))
              return <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`nav-link${active ? " nav-link-active" : ""}`} aria-current={active ? "page" : undefined} title={collapsed ? (rtl ? ar : label) : undefined}>
                <Icon size={18} strokeWidth={1.8} /><span className="nav-link-text">{rtl ? ar : label}</span>{badge && !collapsed && <span className="nav-count">{badge}</span>}
              </Link>
            })}
          </div>)}
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
          {dashboard ? <OverviewDashboard data={data} language={language} search={search} /> : route === "/app/forms" ? <FormsLibrary /> : <ComingSoon language={language} route={route} title={rtl ? current?.ar : current?.label} />}
        </main>
      </div>
    </div>
  )
}

function ComingSoon({ language, route, title }: { language: Language; route: string; title?: string }) {
  const rtl = language === "ar"
  return <section className="coming-soon"><div className="coming-icon"><ClipboardList size={24} /></div><p className="eyebrow">{rtl ? "مساحة العمل" : "SENTRIQ WORKSPACE"}</p><h1>{title ?? route.split("/").filter(Boolean).at(-1)}</h1><p>{rtl ? "هذه الصفحة جزء من إصدار مستقبلي. التنقل جاهز، وسيتم تقديم الوظائف في المرحلة التالية." : "This area is part of a future release. Navigation is ready; workflow features will be introduced in the next phase."}</p><Link href="/app/dashboard" className="button-primary"><LayoutDashboard size={16} />{rtl ? "العودة إلى النظرة العامة" : "Back to overview"}</Link></section>
}
