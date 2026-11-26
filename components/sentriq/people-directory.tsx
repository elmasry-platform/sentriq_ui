"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, type FormEvent } from "react"
import { ArrowLeft, ArrowRight, Building2, CircleAlert, Mail, Plus, Search, ShieldCheck, UserRound, Users, X } from "lucide-react"
import { Dialog } from "@/components/sentriq/dialog"
import type { Language } from "@/components/sentriq/app-shell"
import { can } from "@/lib/sentriq/demo-permissions"
import { functionalRoles, members as seedMembers, orgUnits, sites, type Member } from "@/lib/sentriq/admin-data"

type Props = { route: string; workspaceId: string; role: string; language: Language; sessionMembers: Member[]; sessionMembersLoaded: boolean; onAddMember: (member: Member) => void }
type StatusFilter = "All statuses" | "Active" | "Suspended"

const text = {
  en: {
    title: "People & Workforce", breadcrumb: "Organization / People directory", subtitle: "Workspace memberships, assigned roles, and operational site scope.", sample: "Illustrative Northstar sample data · no HR or identity provider connected", sampleUnavailable: "No Northstar sample memberships for this workspace · no HR or identity provider connected", total: "People", search: "Search name, email, or ID", site: "All sites", unit: "All organization units", status: "Status", statusAll: "All statuses", active: "Active", suspended: "Suspended", add: "Add person", directory: "Directory", person: "Person", role: "Functional role", level: "Management level", sites: "Site scope", units: "Organization units", activity: "Last activity", actions: "Actions", view: "View details", manage: "Manage access", noMatches: "No people match these filters", noMatchesHint: "Change the search or clear one of the filters.", noWorkspace: "No sample directory records for this workspace", noWorkspaceHint: "The current preview member model only contains Northstar sample memberships.", errorTitle: "Directory data is unavailable", errorHint: "The preview member records could not be read. Try refreshing the page.", notFound: "Person not found", notFoundHint: "This person is not part of the current workspace directory.", denied: "Directory access is limited", deniedHint: "People and access records are only visible to company administrators in this role preview.", id: "Record ID", email: "Work email", emptyRole: "No functional role assigned", formTitle: "Add a sample person", close: "Close dialog", cancel: "Cancel", save: "Add to this session", name: "Full name", management: "Management level", selectRole: "Functional roles", chooseSites: "Assigned sites", chooseUnits: "Organization units", required: "Complete the required fields and choose at least one site and unit.", invalidEmail: "Enter a valid work email address.", duplicateEmail: "A person with this email already exists.", sessionNote: "This sample record stays in this browser session only. It is not sent to a server or saved to production.", sessionAdded: "Session-only preview record", detailTitle: "Person details", back: "Back to directory", statusUnavailable: "Status not tracked", notSupported: "Not included in the current member model", emptySite: "No site assigned", emptyUnit: "No unit assigned", accessNote: "Role-based visibility preview only; this is not production authorization.", overview: "Overview", access: "Access scope"
  },
  ar: {
    title: "الأفراد والقوى العاملة", breadcrumb: "المؤسسة / دليل الأفراد", subtitle: "عضويات مساحة العمل والأدوار ونطاق المواقع التشغيلية.", sample: "بيانات توضيحية لمؤسسة Northstar · لا يوجد نظام موارد بشرية أو هوية متصل", sampleUnavailable: "لا توجد عضويات Northstar للمعاينة في مساحة العمل هذه · لا يوجد نظام موارد بشرية أو هوية متصل", total: "الأفراد", search: "ابحث بالاسم أو البريد أو المعرّف", site: "كل المواقع", unit: "كل الوحدات التنظيمية", status: "الحالة", statusAll: "كل الحالات", active: "نشط", suspended: "موقوف", add: "إضافة شخص", directory: "الدليل", person: "الشخص", role: "الدور الوظيفي", level: "المستوى الإداري", sites: "نطاق المواقع", units: "الوحدات التنظيمية", activity: "آخر نشاط", actions: "الإجراءات", view: "عرض التفاصيل", manage: "إدارة الوصول", noMatches: "لا يوجد أشخاص يطابقون عوامل التصفية", noMatchesHint: "غيّر البحث أو أزل أحد عوامل التصفية.", noWorkspace: "لا توجد سجلات دليل معاينة لمساحة العمل هذه", noWorkspaceHint: "يحتوي نموذج أعضاء المعاينة الحالي على عضويات Northstar فقط.", errorTitle: "بيانات الدليل غير متاحة", errorHint: "تعذرت قراءة سجلات أعضاء المعاينة. حاول تحديث الصفحة.", notFound: "الشخص غير موجود", notFoundHint: "هذا الشخص غير موجود في دليل مساحة العمل الحالية.", denied: "الوصول إلى الدليل محدود", deniedHint: "لا تظهر سجلات الأفراد والوصول إلا لمسؤولي الشركة في معاينة الأدوار هذه.", id: "معرّف السجل", email: "بريد العمل", emptyRole: "لا يوجد دور وظيفي مسند", formTitle: "إضافة شخص نموذجي", close: "إغلاق النافذة", cancel: "إلغاء", save: "إضافة إلى هذه الجلسة", name: "الاسم الكامل", management: "المستوى الإداري", selectRole: "الأدوار الوظيفية", chooseSites: "المواقع المسندة", chooseUnits: "الوحدات التنظيمية", required: "أكمل الحقول المطلوبة واختر موقعًا ووحدة على الأقل.", invalidEmail: "أدخل بريد عمل صالحًا.", duplicateEmail: "يوجد شخص بهذا البريد الإلكتروني بالفعل.", sessionNote: "يبقى سجل المعاينة هذا في جلسة المتصفح الحالية فقط. لا يُرسل إلى خادم أو يُحفظ في الإنتاج.", sessionAdded: "سجل معاينة مؤقت للجلسة", detailTitle: "تفاصيل الشخص", back: "العودة إلى الدليل", statusUnavailable: "الحالة غير متتبعة", notSupported: "غير متاح في نموذج العضو الحالي", emptySite: "لا يوجد موقع مسند", emptyUnit: "لا توجد وحدة مسندة", accessNote: "معاينة حسب الدور فقط؛ لا يمثل تفويضًا إنتاجيًا.", overview: "نظرة عامة", access: "نطاق الوصول"
  }
}

function isMemberRecord(value: unknown): value is Member {
  if (!value || typeof value !== "object") return false
  const record = value as Partial<Member>
  return typeof record.id === "string" && typeof record.name === "string" && typeof record.email === "string" && (record.status === "Active" || record.status === "Suspended") && Array.isArray(record.roles) && Array.isArray(record.sites) && Array.isArray(record.units)
}

export function PeopleDirectory({ route, workspaceId, role, language, sessionMembers, sessionMembersLoaded, onAddMember }: Props) {
  const t = text[language]
  const rtl = language === "ar"
  const canView = can(role, "admin.access")
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All statuses")
  const [siteFilter, setSiteFilter] = useState("all")
  const [unitFilter, setUnitFilter] = useState("all")
  const [addOpen, setAddOpen] = useState(false)
  const [formMessage, setFormMessage] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [level, setLevel] = useState<Member["level"]>("Employee")
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["Inspector"])
  const [selectedSites, setSelectedSites] = useState<string[]>(sites.slice(0, 1))
  const [selectedUnits, setSelectedUnits] = useState<string[]>(orgUnits.slice(0, 1))
  const [clientReady, setClientReady] = useState(false)
  useEffect(() => { setClientReady(true) }, [])

  const dataError = !Array.isArray(seedMembers) || !seedMembers.every(isMemberRecord) || !sessionMembers.every(isMemberRecord)
  const allMembers = useMemo(() => workspaceId === "ws_northstar" && !dataError ? [...seedMembers, ...sessionMembers] : [], [workspaceId, sessionMembers, dataError])
  const personId = route.split("/").at(-1)
  const isDetail = route !== "/app/people"
  const selectedPerson = isDetail ? allMembers.find((member) => member.id === personId) : undefined
  const activeCount = allMembers.filter((member) => member.status === "Active").length
  const suspendedCount = allMembers.filter((member) => member.status === "Suspended").length
  const filteredMembers = useMemo(() => allMembers.filter((member) => {
    const searchValue = `${member.id} ${member.name} ${member.email} ${member.roles.join(" ")} ${member.sites.join(" ")} ${member.units.join(" ")}`.toLocaleLowerCase()
    return searchValue.includes(query.trim().toLocaleLowerCase())
      && (statusFilter === "All statuses" || member.status === statusFilter)
      && (siteFilter === "all" || member.sites.includes(siteFilter))
      && (unitFilter === "all" || member.units.includes(unitFilter))
  }), [allMembers, query, statusFilter, siteFilter, unitFilter])

  const resetForm = () => {
    setName("")
    setEmail("")
    setLevel("Employee")
    setSelectedRoles(["Inspector"])
    setSelectedSites(sites.slice(0, 1))
    setSelectedUnits(orgUnits.slice(0, 1))
    setFormMessage("")
  }

  const addPerson = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedEmail = email.trim().toLocaleLowerCase()
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(normalizedEmail) || !selectedSites.length || !selectedUnits.length || !selectedRoles.length) {
      setFormMessage(!/^\S+@\S+\.\S+$/.test(normalizedEmail) ? t.invalidEmail : t.required)
      return
    }
    if (allMembers.some((member) => member.email.toLocaleLowerCase() === normalizedEmail)) {
      setFormMessage(t.duplicateEmail)
      return
    }
    onAddMember({ id: `demo-${Date.now()}`, name: name.trim(), email: normalizedEmail, level, roles: selectedRoles, status: "Active", sites: selectedSites, units: selectedUnits, activity: t.sessionAdded })
    resetForm()
    setAddOpen(false)
  }

  if (!canView) return <section className="people-page" dir={rtl ? "rtl" : "ltr"}><PageHeading title={t.title} breadcrumb={t.breadcrumb} subtitle={t.subtitle} /><div className="ux-state ux-state-locked"><span className="ux-state-icon"><ShieldCheck size={22} /></span><h2>{t.denied}</h2><p>{t.deniedHint}</p><p className="people-demo-note">{t.accessNote}</p></div></section>

  if (!clientReady || !sessionMembersLoaded) return <section className="people-page" dir={rtl ? "rtl" : "ltr"} aria-busy="true"><PageHeading title={t.title} breadcrumb={t.breadcrumb} subtitle={t.subtitle} /><div className="ux-loading" role="status" aria-label={t.directory}><span /><span /><span /></div></section>

  if (dataError) return <section className="people-page" dir={rtl ? "rtl" : "ltr"}><PageHeading title={t.title} breadcrumb={t.breadcrumb} subtitle={t.subtitle} /><div className="ux-state ux-state-error"><span className="ux-state-icon"><CircleAlert size={22} /></span><h2>{t.errorTitle}</h2><p>{t.errorHint}</p></div></section>

  if (isDetail) {
    if (!selectedPerson) return <section className="people-page" dir={rtl ? "rtl" : "ltr"}><PageHeading title={t.title} breadcrumb={t.breadcrumb} subtitle={t.subtitle} /><div className="ux-state"><span className="ux-state-icon"><UserRound size={22} /></span><h2>{t.notFound}</h2><p>{t.notFoundHint}</p><Link href="/app/people" className="ops-section-link"><ArrowLeft size={14} />{t.back}</Link></div></section>
    return <PersonDetail person={selectedPerson} language={language} onBack={t.back} />
  }

  return <section className="people-page" dir={rtl ? "rtl" : "ltr"}>
    <PageHeading title={t.title} breadcrumb={t.breadcrumb} subtitle={t.subtitle} />
    <div className="people-record-note"><span className="people-demo-dot" />{workspaceId === "ws_northstar" ? t.sample : t.sampleUnavailable}<span className="people-record-count"><Users size={15} />{allMembers.length} {t.total}</span></div>
    <section className="people-directory" aria-label={t.directory}>
      <div className="people-toolbar">
        <label className="people-search"><Search size={17} /><span className="sr-only">{t.search}</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} /></label>
        <label className="people-filter"><span className="sr-only">{t.status}</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="All statuses">{t.statusAll} · {allMembers.length}</option><option value="Active">{t.active} · {activeCount}</option><option value="Suspended">{t.suspended} · {suspendedCount}</option></select></label>
        <label className="people-filter"><span className="sr-only">{t.site}</span><select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)}><option value="all">{t.site}</option>{sites.map((site) => <option value={site} key={site}>{site}</option>)}</select></label>
        <label className="people-filter"><span className="sr-only">{t.unit}</span><select value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)}><option value="all">{t.unit}</option>{orgUnits.map((unit) => <option value={unit} key={unit}>{unit}</option>)}</select></label>
        <button type="button" className="button-primary people-add-button" onClick={() => setAddOpen(true)}><Plus size={16} />{t.add}</button>
      </div>

      {workspaceId !== "ws_northstar" ? <div className="ux-state"><span className="ux-state-icon"><Users size={21} /></span><h2>{t.noWorkspace}</h2><p>{t.noWorkspaceHint}</p></div> : filteredMembers.length ? <div className="people-table-wrap" role="region" aria-label={t.directory} tabIndex={0}><table className="people-table"><thead><tr><th>{t.person}</th><th>{t.level}</th><th>{t.role}</th><th>{t.status}</th><th>{t.sites}</th><th>{t.units}</th><th>{t.actions}</th></tr></thead><tbody>{filteredMembers.map((member) => <tr key={member.id}>
        <td data-label={t.person}><Link href={`/app/people/${member.id}`} className="people-person"><span className="people-avatar">{member.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><span><strong>{member.name}</strong><small>{member.email}</small></span></Link></td>
        <td data-label={t.level}><span className="people-level">{language === "ar" ? ({ "Company Superadmin": "مدير الشركة الأعلى", "Company Admin": "مدير الشركة", Employee: "موظف" } as Record<string, string>)[member.level] : member.level}</span></td>
        <td data-label={t.role}><div className="people-role-list">{member.roles.length ? member.roles.map((item) => <span className="people-role-chip" key={item}>{language === "ar" ? ({ Inspector: "مفتش", "Reviewer 1": "المراجع الأول", "Reviewer 2": "المراجع الثاني", "Final Reviewer": "المراجع النهائي", "Action Owner": "مسؤول الإجراء", "Closure Reviewer": "مراجع الإغلاق", Auditor: "مدقق" } as Record<string, string>)[item] ?? item : item}</span>) : <span>{t.emptyRole}</span>}</div></td>
        <td data-label={t.status}><span className={`ux-badge ${member.status === "Active" ? "ux-badge-approved" : "ux-badge-returned"}`}><i className="people-status-dot" />{language === "ar" ? member.status === "Active" ? t.active : t.suspended : member.status}</span></td>
        <td data-label={t.sites}>{member.sites.join(", ") || t.emptySite}</td>
        <td data-label={t.units}>{member.units.join(", ") || t.emptyUnit}</td>
        <td data-label={t.actions}><div className="people-row-actions"><Link href={`/app/people/${member.id}`} className="people-view-action" aria-label={`${t.view}: ${member.name}`} title={t.view}><ArrowRight size={16} /></Link><Link href="/app/admin/members" className="people-manage-action">{t.manage}</Link></div></td>
      </tr>)}</tbody></table></div> : <div className="ux-state"><span className="ux-state-icon"><Search size={20} /></span><h2>{allMembers.length ? t.noMatches : t.noWorkspace}</h2><p>{allMembers.length ? t.noMatchesHint : t.noWorkspaceHint}</p></div>}
    </section>
    <p className="people-demo-note">{t.accessNote} {t.sessionNote}</p>

    {addOpen && <Dialog title={t.formTitle} closeLabel={t.close} onClose={() => { setAddOpen(false); resetForm() }}>
      <form className="people-form" onSubmit={addPerson} onKeyDown={(event) => { if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault() }}>
        <p className="people-form-note">{t.sessionNote}</p>
        {formMessage && <p className="people-form-error" role="alert">{formMessage}</p>}
        <label>{t.name}<input data-autofocus value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" /></label>
        <label>{t.email}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
        <label>{t.management}<select value={level} onChange={(event) => setLevel(event.target.value as Member["level"])}><option value="Employee">{language === "ar" ? "موظف" : "Employee"}</option><option value="Company Admin">{language === "ar" ? "مدير الشركة" : "Company Admin"}</option><option value="Company Superadmin">{language === "ar" ? "مدير الشركة الأعلى" : "Company Superadmin"}</option></select></label>
        <fieldset><legend>{t.selectRole}</legend><div className="people-check-grid">{functionalRoles.map((item) => <label key={item.name}><input type="checkbox" checked={selectedRoles.includes(item.name)} onChange={() => setSelectedRoles((current) => current.includes(item.name) ? current.filter((value) => value !== item.name) : [...current, item.name])} />{language === "ar" ? ({ Inspector: "مفتش", "Reviewer 1": "المراجع الأول", "Reviewer 2": "المراجع الثاني", "Final Reviewer": "المراجع النهائي", "Action Owner": "مسؤول الإجراء", "Closure Reviewer": "مراجع الإغلاق", Auditor: "مدقق" } as Record<string, string>)[item.name] ?? item.name : item.name}</label>)}</div></fieldset>
        <fieldset><legend>{t.chooseSites}</legend><div className="people-check-grid">{sites.map((site) => <label key={site}><input type="checkbox" checked={selectedSites.includes(site)} onChange={() => setSelectedSites((current) => current.includes(site) ? current.filter((value) => value !== site) : [...current, site])} />{site}</label>)}</div></fieldset>
        <fieldset><legend>{t.chooseUnits}</legend><div className="people-check-grid">{orgUnits.map((unit) => <label key={unit}><input type="checkbox" checked={selectedUnits.includes(unit)} onChange={() => setSelectedUnits((current) => current.includes(unit) ? current.filter((value) => value !== unit) : [...current, unit])} />{language === "ar" ? ({ HSE: "الصحة والسلامة والبيئة", Operations: "العمليات", Quality: "الجودة" } as Record<string, string>)[unit] : unit}</label>)}</div></fieldset>
        <div className="people-form-actions"><button type="button" className="button-outline" onClick={() => { setAddOpen(false); resetForm() }}>{t.cancel}</button><button type="submit" className="button-primary"><Plus size={15} />{t.save}</button></div>
      </form>
    </Dialog>}
  </section>
}

function PageHeading({ title, breadcrumb, subtitle }: { title: string; breadcrumb: string; subtitle: string }) {
  return <header className="people-page-heading"><p className="people-breadcrumb">{breadcrumb}</p><h1>{title}</h1><p>{subtitle}</p></header>
}

function PersonDetail({ person, language, onBack }: { person: Member; language: Language; onBack: string }) {
  const t = text[language]
  const rtl = language === "ar"
  const management = language === "ar" ? ({ "Company Superadmin": "مدير الشركة الأعلى", "Company Admin": "مدير الشركة", Employee: "موظف" } as Record<string, string>)[person.level] : person.level
  const roles = language === "ar" ? person.roles.map((role) => ({ Inspector: "مفتش", "Reviewer 1": "المراجع الأول", "Reviewer 2": "المراجع الثاني", "Final Reviewer": "المراجع النهائي", "Action Owner": "مسؤول الإجراء", "Closure Reviewer": "مراجع الإغلاق", Auditor: "مدقق" } as Record<string, string>)[role] ?? role) : person.roles
  return <section className="people-page" dir={rtl ? "rtl" : "ltr"}>
    <PageHeading title={t.title} breadcrumb={`${t.breadcrumb} / ${person.name}`} subtitle={t.detailTitle} />
    <div className="people-detail-actions"><Link href="/app/people" className="button-outline"><ArrowLeft size={15} />{t.back}</Link><Link href="/app/admin/members" className="button-primary"><ShieldCheck size={15} />{t.manage}</Link></div>
    <article className="people-detail-panel">
      <header className="people-detail-header"><span className="people-avatar people-avatar-large"><UserRound size={23} /></span><div><h2>{person.name}</h2><p><Mail size={14} />{person.email}</p><span className={`ux-badge ${person.status === "Active" ? "ux-badge-approved" : "ux-badge-returned"}`}><i className="people-status-dot" />{language === "ar" ? person.status === "Active" ? t.active : t.suspended : person.status}</span></div><span className="people-detail-id">{person.id}</span></header>
      <section className="people-detail-group"><h3>{t.overview}</h3><dl className="people-detail-fields"><div><dt>{t.management}</dt><dd>{management}</dd></div><div><dt>{t.activity}</dt><dd>{person.activity ?? t.statusUnavailable}</dd></div><div><dt>{t.role}</dt><dd>{roles.length ? roles.join(" · ") : t.emptyRole}</dd></div></dl></section>
      <section className="people-detail-group"><h3>{t.access}</h3><dl className="people-detail-fields"><div><dt><Building2 size={14} />{t.sites}</dt><dd>{person.sites.length ? person.sites.join(" · ") : t.emptySite}</dd></div><div><dt>{t.units}</dt><dd>{person.units.length ? person.units.join(" · ") : t.emptyUnit}</dd></div></dl></section>
    </article>
    <p className="people-demo-note">{t.accessNote} {t.sessionNote}</p>
  </section>
}
