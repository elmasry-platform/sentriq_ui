"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, ChevronDown, ClipboardCheck, FileText, ShieldCheck, TriangleAlert } from "lucide-react"

const content = {
  en: {
    nav: ["Product", "Platform", "Modules", "Solutions", "Company"],
    signIn: "Sign in", enter: "Enter workspace", eyebrow: "FIELD INTELLIGENCE — OPERATIONAL PRECISION", exploreModules: "Explore modules", visualTop: "OPERATIONAL CONTROL / 01", visualMap: "CONNECTED SYSTEM MAP", visualLabels: ["INSPECTIONS", "RISK & COMPLIANCE", "EVIDENCE", "ACTIONS"], visualStates: ["ACTIVE", "MONITORED", "LINKED", "TRACKED"], connectionFoot: "FROM FIELD TO FOLLOW-THROUGH",
    title: "Operational intelligence.\nComplete QHSE control.",
    subtitle: "One connected platform to manage inspections, operational risks, compliance, incidents, and corrective actions across your organization.",
    explore: "Explore the platform", workflow: "See how it connects", network: "A connected operating system", networkText: "Every observation has a next step. SENTRIQ connects frontline activity to accountable action and management insight.",
    flow: ["Inspection", "Finding", "Corrective action", "Verification", "Closure"],
    ecosystem: "One system. Every operational thread.", ecosystemText: "Bring your QHSE work into a shared operating picture—from the worksite to leadership.",
    groups: [
      { name: "Operate", items: ["Inspections & forms", "Incidents & observations", "Permits to work"] },
      { name: "Control", items: ["Risk assessments", "Audits & compliance", "Findings & actions"] },
      { name: "Enable", items: ["Documents & evidence", "Sites & organization", "People & equipment"] },
      { name: "Understand", items: ["Reports & analytics", "Management review", "Audit trail"] },
    ],
    lifecycle: "From field activity to verified outcome", steps: ["Plan", "Inspect", "Identify", "Assign", "Correct", "Verify", "Analyze"],
    capabilities: "Built for the realities of enterprise QHSE", cap: ["Multi-site operations", "Standardized templates", "Controlled workflows", "Evidence relationships", "Central oversight", "English & Arabic experience"],
    cta: "Bring your operations into focus.", ctaText: "Explore the SENTRIQ workspace and see how connected QHSE workflows fit together.", footer: "Field Intelligence — Operational Precision", copyright: "© 2026 SENTRIQ. Product capabilities are evolving.",
  },
  ar: {
    nav: ["المنتج", "المنصة", "الوحدات", "الحلول", "الشركة"], signIn: "تسجيل الدخول", enter: "دخول مساحة العمل", eyebrow: "ذكاء ميداني — دقة تشغيلية", exploreModules: "استكشف الوحدات", visualTop: "التحكم التشغيلي / ٠١", visualMap: "خريطة النظام المترابط", visualLabels: ["التفتيش", "المخاطر والامتثال", "الأدلة", "الإجراءات"], visualStates: ["نشط", "مراقب", "مرتبط", "متابع"], connectionFoot: "من الميدان إلى المتابعة",
    title: "ذكاء تشغيلي.\nتحكم متكامل في QHSE.", subtitle: "منصة مترابطة لإدارة التفتيش والمخاطر التشغيلية والامتثال والحوادث والإجراءات التصحيحية عبر مؤسستك.", explore: "استكشف المنصة", workflow: "اكتشف ترابطها", network: "نظام تشغيلي مترابط", networkText: "لكل ملاحظة خطوة تالية. تربط SENTRIQ العمل الميداني بإجراء مسؤول ورؤية إدارية واضحة.",
    flow: ["التفتيش", "الملاحظة", "إجراء تصحيحي", "التحقق", "الإغلاق"], ecosystem: "نظام واحد. لكل مسار تشغيلي.", ecosystemText: "اجمع أعمال QHSE في صورة تشغيلية مشتركة — من موقع العمل إلى القيادة.",
    groups: [
      { name: "التشغيل", items: ["التفتيش والنماذج", "الحوادث والملاحظات", "تصاريح العمل"] },
      { name: "الضبط", items: ["تقييم المخاطر", "التدقيق والامتثال", "الملاحظات والإجراءات"] },
      { name: "التمكين", items: ["المستندات والأدلة", "المواقع والمؤسسة", "الأفراد والمعدات"] },
      { name: "الرؤى", items: ["التقارير والتحليلات", "مراجعة الإدارة", "سجل التدقيق"] },
    ], lifecycle: "من النشاط الميداني إلى النتيجة المتحققة", steps: ["خطط", "افحص", "حدد", "أسند", "صحح", "تحقق", "حلل"], capabilities: "مصممة لواقع QHSE المؤسسي", cap: ["عمليات متعددة المواقع", "نماذج موحدة", "مسارات عمل مضبوطة", "ترابط الأدلة", "إشراف مركزي", "تجربة عربية وإنجليزية"], cta: "ضع عملياتك في بؤرة الاهتمام.", ctaText: "استكشف مساحة عمل SENTRIQ واكتشف ترابط مسارات QHSE.", footer: "ذكاء ميداني — دقة تشغيلية", copyright: "© 2026 SENTRIQ. قدرات المنتج قيد التطوير.",
  },
}

export function PublicHome() {
  const [language, setLanguage] = useState<"en" | "ar">("en")
  const t = content[language]
  const rtl = language === "ar"
  return <main className="public-site" dir={rtl ? "rtl" : "ltr"} lang={language}>
    <header className="public-header"><Link className="public-brand" href="/" aria-label="SENTRIQ"><span className="public-mark">S</span><span>SENTRIQ<span className="brand-period">.</span></span></Link><nav className="public-nav" aria-label={rtl ? "التنقل الرئيسي" : "Main navigation"}>{t.nav.map((label, index) => <a key={label} href={index === 2 ? "#modules" : index === 1 ? "#platform" : "#about"}>{label}</a>)}</nav><div className="public-actions"><button className="language-switch" onClick={() => setLanguage(rtl ? "en" : "ar")} aria-label={rtl ? "Switch to English" : "التغيير إلى العربية"}>{rtl ? "EN" : "عربي"}</button><Link className="public-signin" href="/login">{t.signIn}</Link><Link className="public-enter" href="/login">{t.enter}<ArrowUpRight size={15} /></Link></div></header>
    <section className="public-hero"><div className="hero-copy"><p className="public-eyebrow"><span />{t.eyebrow}</p><h1>{t.title}</h1><p className="public-lede">{t.subtitle}</p><div className="hero-ctas"><a className="public-enter" href="#platform">{t.explore}<ArrowRight size={16} /></a><Link className="hero-text-link" href="/login">{t.enter}<ArrowUpRight size={15} /></Link></div><div className="hero-note"><span className="note-rule" />QHSE · RISK · COMPLIANCE · OPERATIONS</div></div><div className="hero-visual" aria-label={rtl ? "تصور لترابط وحدات SENTRIQ" : "Illustration of connected SENTRIQ modules"}><div className="visual-topline"><span>{t.visualTop}</span><span>{t.visualMap}</span></div><div className="visual-orbit orbit-one"/><div className="visual-orbit orbit-two"/><div className="visual-center"><span className="center-mark">S</span><strong>SENTRIQ</strong><small>{rtl ? "نظام تشغيل QHSE" : "QHSE OPERATING SYSTEM"}</small></div><div className="visual-node node-inspection"><ClipboardCheck/><span>{t.visualLabels[0]}</span><i>{t.visualStates[0]}</i></div><div className="visual-node node-risk"><TriangleAlert/><span>{t.visualLabels[1]}</span><i>{t.visualStates[1]}</i></div><div className="visual-node node-evidence"><FileText/><span>{t.visualLabels[2]}</span><i>{t.visualStates[2]}</i></div><div className="visual-node node-actions"><ShieldCheck/><span>{t.visualLabels[3]}</span><i>{t.visualStates[3]}</i></div><div className="visual-coordinate">24° 42′ N &nbsp; 46° 40′ E</div><div className="visual-index">01 <span>/</span> 04</div></div></section>
    <section id="platform" className="connection-section"><div className="section-heading"><p className="public-eyebrow">01 / PLATFORM</p><h2>{t.network}</h2><p>{t.networkText}</p></div><div className="flow-line">{t.flow.map((item, index) => <div className="flow-step" key={item}><span className="flow-index">0{index + 1}</span><strong>{item}</strong>{index < t.flow.length - 1 && <ArrowRight className="flow-arrow"/>}</div>)}</div><div className="connection-foot"><span>ONE RECORD · SHARED CONTEXT</span><span>{t.connectionFoot} <ArrowDownRight size={14}/></span></div></section>
    <section id="modules" className="modules-section"><div className="modules-intro"><p className="public-eyebrow">02 / MODULE ECOSYSTEM</p><h2>{t.ecosystem}</h2><p>{t.ecosystemText}</p><Link href="/app/modules" className="module-link">{t.exploreModules} <ArrowUpRight size={15}/></Link></div><div className="module-groups">{t.groups.map((group, index) => <article className="module-group" key={group.name}><div className="group-number">0{index + 1}</div><div><h3>{group.name}</h3><ul>{group.items.map(item => <li key={item}><Check size={14}/>{item}</li>)}</ul></div><ArrowUpRight className="group-arrow" size={17}/></article>)}</div></section>
    <section className="lifecycle-section"><div className="lifecycle-top"><p className="public-eyebrow">03 / OPERATIONAL LIFECYCLE</p><h2>{t.lifecycle}</h2></div><div className="lifecycle-steps">{t.steps.map((step, index) => <div className="lifecycle-step" key={step}><span>0{index + 1}</span><strong>{step}</strong>{index < t.steps.length - 1 && <i/>}</div>)}</div></section>
    <section id="about" className="capabilities-section"><div><p className="public-eyebrow">04 / ENTERPRISE CAPABILITIES</p><h2>{t.capabilities}</h2></div><ul>{t.cap.map(item => <li key={item}><Check size={15}/>{item}</li>)}</ul></section>
    <section className="closing-section"><div><p className="public-eyebrow">SENTRIQ WORKSPACE</p><h2>{t.cta}</h2><p>{t.ctaText}</p></div><Link className="public-enter" href="/login">{t.enter}<ArrowUpRight size={16}/></Link></section>
    <footer className="public-footer"><Link className="public-brand" href="/"><span className="public-mark">S</span><span>SENTRIQ<span className="brand-period">.</span></span></Link><span>{t.footer}</span><div><Link href="#modules">Modules</Link><Link href="/login">Sign in</Link><button className="footer-language" onClick={() => setLanguage(rtl ? "en" : "ar")}>{rtl ? "English" : "العربية"}</button></div><small>{t.copyright}</small></footer>
  </main>
}
