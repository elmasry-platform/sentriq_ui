"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChartNoAxesCombined, Check, ClipboardCheck, FolderOpen, ShieldCheck } from "lucide-react"
import { OverviewDashboard } from "./overview-dashboard"
import type { Language } from "./app-shell"
import { mockSentriqDashboardService } from "@/lib/sentriq/dashboard-service"

const content = {
  en: {
    nav: ["Product", "Platform", "Modules", "Solutions", "Company"],
    signIn: "Sign in", enter: "Enter workspace", eyebrow: "FIELD INTELLIGENCE — OPERATIONAL PRECISION", exploreModules: "Explore modules",
    title: "Operational intelligence.\nComplete QHSE control.",
    subtitle: "One connected platform to manage inspections, operational risks, compliance, incidents, and corrective actions across your organization.",
    explore: "Explore the platform", workflow: "See how it connects", liveWorkspace: "LIVE WORKSPACE", connectionFoot: "FROM FIELD TO FOLLOW-THROUGH",
    lifecycle: "From field activity to verified outcome", lifecycleText: "Every observation has a next step. SENTRIQ connects frontline activity to accountable action and management insight — one record, shared context.",
    steps: [
      { name: "Plan", detail: "Templates & schedules" },
      { name: "Inspect", detail: "Field capture, offline" },
      { name: "Identify", detail: "Findings linked to evidence" },
      { name: "Assign", detail: "Named owner, due date" },
      { name: "Correct", detail: "Action tracked to closure" },
      { name: "Verify", detail: "Reviewer sign-off" },
      { name: "Analyze", detail: "Trends feed management" },
    ],
    ecosystem: "One system. Every operational thread.", ecosystemText: "Bring your QHSE work into a shared operating picture—from the worksite to leadership.",
    groups: [
      { name: "Operate", state: "Working prototype", items: ["Inspections & forms", "Incidents & observations", "Permits to work"] },
      { name: "Control", state: "Working prototype", items: ["Risk assessments", "Audits & compliance", "Findings & actions"] },
      { name: "Enable", state: "Demonstration", items: ["Documents & evidence", "Sites & organization", "People & equipment"] },
      { name: "Understand", state: "Demonstration", items: ["Reports & analytics", "Management review", "Audit trail"] },
    ],
    openModule: "Open module",
    capabilities: "Built for the realities of enterprise QHSE",
    caps: [
      { label: "Multi-site", text: "Operations across every site, one oversight view" },
      { label: "Controlled", text: "Standardized templates and governed workflows" },
      { label: "Bilingual", text: "Full English & Arabic experience, native RTL" },
    ],
    cta: "Bring your operations into focus.", ctaText: "Explore the SENTRIQ workspace and see how connected QHSE workflows fit together.",
    footer: "Field Intelligence — Operational Precision", copyright: "© 2026 SENTRIQ. Product capabilities are evolving.",
  },
  ar: {
    nav: ["المنتج", "المنصة", "الوحدات", "الحلول", "الشركة"],
    signIn: "تسجيل الدخول", enter: "دخول مساحة العمل", eyebrow: "ذكاء ميداني — دقة تشغيلية", exploreModules: "استكشف الوحدات",
    title: "ذكاء تشغيلي.\nتحكم متكامل في QHSE.",
    subtitle: "منصة مترابطة لإدارة التفتيش والمخاطر التشغيلية والامتثال والحوادث والإجراءات التصحيحية عبر مؤسستك.",
    explore: "استكشف المنصة", workflow: "اكتشف ترابطها", liveWorkspace: "مساحة عمل مباشرة", connectionFoot: "من الميدان إلى المتابعة",
    lifecycle: "من النشاط الميداني إلى النتيجة المتحققة", lifecycleText: "لكل ملاحظة خطوة تالية. تربط SENTRIQ العمل الميداني بإجراء مسؤول ورؤية إدارية واضحة — سجل واحد وسياق مشترك.",
    steps: [
      { name: "خطط", detail: "نماذج وجداول" },
      { name: "افحص", detail: "التقاط ميداني، دون اتصال" },
      { name: "حدد", detail: "ملاحظات مرتبطة بالأدلة" },
      { name: "أسند", detail: "مسؤول محدد وموعد" },
      { name: "صحح", detail: "إجراء متابع حتى الإغلاق" },
      { name: "تحقق", detail: "اعتماد المراجع" },
      { name: "حلل", detail: "اتجاهات تغذي الإدارة" },
    ],
    ecosystem: "نظام واحد. لكل مسار تشغيلي.", ecosystemText: "اجمع أعمال QHSE في صورة تشغيلية مشتركة — من موقع العمل إلى القيادة.",
    groups: [
      { name: "التشغيل", state: "نموذج أولي عامل", items: ["التفتيش والنماذج", "الحوادث والملاحظات", "تصاريح العمل"] },
      { name: "الضبط", state: "نموذج أولي عامل", items: ["تقييم المخاطر", "التدقيق والامتثال", "الملاحظات والإجراءات"] },
      { name: "التمكين", state: "عرض توضيحي", items: ["المستندات والأدلة", "المواقع والمؤسسة", "الأفراد والمعدات"] },
      { name: "الرؤى", state: "عرض توضيحي", items: ["التقارير والتحليلات", "مراجعة الإدارة", "سجل التدقيق"] },
    ],
    openModule: "فتح الوحدة",
    capabilities: "مصممة لواقع QHSE المؤسسي",
    caps: [
      { label: "متعدد المواقع", text: "عمليات عبر كل المواقع برؤية إشرافية واحدة" },
      { label: "مضبوط", text: "نماذج موحدة ومسارات عمل محكومة" },
      { label: "ثنائي اللغة", text: "تجربة عربية وإنجليزية كاملة مع دعم RTL" },
    ],
    cta: "ضع عملياتك في بؤرة الاهتمام.", ctaText: "استكشف مساحة عمل SENTRIQ واكتشف ترابط مسارات QHSE.",
    footer: "ذكاء ميداني — دقة تشغيلية", copyright: "© 2026 SENTRIQ. قدرات المنتج قيد التطوير.",
  },
}

const groupIcons = [ClipboardCheck, ShieldCheck, FolderOpen, ChartNoAxesCombined]

export function PublicHome() {
  const [language, setLanguage] = useState<Language>("en")
  const t = content[language]
  const rtl = language === "ar"
  const data = useMemo(() => mockSentriqDashboardService.getDashboard("ws_northstar"), [])
  return <main className="public-site" dir={rtl ? "rtl" : "ltr"} lang={language}>
    <div className="public-hero-band">
      <header className="public-header">
        <Link className="public-brand" href="/" aria-label="SENTRIQ"><span className="public-mark">S</span><span>SENTRIQ<span className="brand-period">.</span></span></Link>
        <nav className="public-nav" aria-label={rtl ? "التنقل الرئيسي" : "Main navigation"}>{t.nav.map((label, index) => <a key={label} href={index === 2 ? "#modules" : index === 1 ? "#platform" : "#about"}>{label}</a>)}</nav>
        <div className="public-actions"><button className="language-switch" onClick={() => setLanguage(rtl ? "en" : "ar")} aria-label={rtl ? "Switch to English" : "التغيير إلى العربية"}>{rtl ? "EN" : "عربي"}</button><Link className="public-signin" href="/login">{t.signIn}</Link><Link className="public-enter" href="/login">{t.enter}<ArrowUpRight size={15} /></Link></div>
      </header>
      <section className="public-hero">
        <div className="hero-copy">
          <p className="public-eyebrow hero-eyebrow"><span />{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <p className="public-lede">{t.subtitle}</p>
          <div className="hero-ctas"><a className="public-enter" href="#platform">{t.explore}<ArrowRight size={16} /></a><Link className="hero-text-link" href="/login">{t.enter}<ArrowUpRight size={15} /></Link></div>
          <div className="hero-note"><span className="note-rule" />QHSE · RISK · COMPLIANCE · OPERATIONS</div>
        </div>
        <div className="hero-product" aria-label={rtl ? "معاينة حية لمساحة عمل SENTRIQ" : "Live preview of the SENTRIQ workspace"}>
          <div className="hero-product-top"><span className="hero-product-dots"><i /><i /><i /></span><span className="hero-product-url">app.sentriq.com/overview</span><span className="hero-product-live">{t.liveWorkspace}</span></div>
          <div className="hero-product-viewport" aria-hidden="true">
            <div className="hero-product-scale" inert>
              <OverviewDashboard data={data} language={language} search="" role="company_superadmin" workspaceId="ws_northstar" />
            </div>
          </div>
          <div className="hero-product-foot"><span>ONE RECORD · SHARED CONTEXT</span><span>{t.connectionFoot}<ArrowDownRight size={13} /></span></div>
        </div>
      </section>
    </div>

    <section id="platform" className="lifecycle-section">
      <div className="section-heading lifecycle-top">
        <p className="public-eyebrow">01 / PLATFORM</p>
        <h2>{t.lifecycle}</h2>
        <p>{t.lifecycleText}</p>
      </div>
      <ol className="lifecycle-steps">
        {t.steps.map((step, index) => <li className={`lifecycle-step${index < 2 ? " is-done" : index === 2 ? " is-current" : ""}`} key={step.name}>
          <span className="lifecycle-marker" />
          <span className="lifecycle-index">{String(index + 1).padStart(2, "0")}</span>
          <strong>{step.name}</strong>
          <small>{step.detail}</small>
        </li>)}
      </ol>
    </section>

    <section id="modules" className="modules-section">
      <div className="section-heading modules-intro">
        <p className="public-eyebrow">02 / MODULE ECOSYSTEM</p>
        <h2>{t.ecosystem}</h2>
        <p>{t.ecosystemText}</p>
        <Link href="/app/modules" className="module-link">{t.exploreModules} <ArrowUpRight size={15} /></Link>
      </div>
      <div className="module-groups">
        {t.groups.map((group, index) => { const Icon = groupIcons[index]; return <article className="module-group" key={group.name}>
          <div className="module-group-top"><span className="module-group-icon"><Icon size={17} strokeWidth={1.8} /></span><span className="group-number">{String(index + 1).padStart(2, "0")}</span></div>
          <h3>{group.name}</h3>
          <ul>{group.items.map(item => <li key={item}><Check size={14} />{item}</li>)}</ul>
          <div className="module-group-foot"><Link href="/app/modules" className="module-open">{t.openModule}<ArrowUpRight size={14} /></Link><span className="module-state">{group.state}</span></div>
        </article> })}
      </div>
    </section>

    <section id="about" className="capabilities-section">
      <div className="section-heading">
        <p className="public-eyebrow">03 / ENTERPRISE CAPABILITIES</p>
        <h2>{t.capabilities}</h2>
      </div>
      <div className="capability-strip">{t.caps.map((cap) => <div className="capability-cell" key={cap.label}><span>{cap.label}</span><strong>{cap.text}</strong></div>)}</div>
    </section>

    <section className="closing-section">
      <div><p className="public-eyebrow hero-eyebrow">SENTRIQ WORKSPACE</p><h2>{t.cta}</h2><p>{t.ctaText}</p></div>
      <Link className="public-enter" href="/login">{t.enter}<ArrowUpRight size={16} /></Link>
    </section>

    <footer className="public-footer">
      <Link className="public-brand" href="/"><span className="public-mark">S</span><span>SENTRIQ<span className="brand-period">.</span></span></Link>
      <span>{t.footer}</span>
      <div><Link href="#modules">Modules</Link><Link href="/login">Sign in</Link><button className="footer-language" onClick={() => setLanguage(rtl ? "en" : "ar")}>{rtl ? "English" : "العربية"}</button></div>
      <small>{t.copyright}</small>
    </footer>
  </main>
}
