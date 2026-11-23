"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Activity, ArrowDownRight, ArrowRight, CalendarDays, Check, CircleAlert, ClipboardCheck, Clock3, Printer, ShieldAlert } from "lucide-react"
import type { Language } from "@/components/sentriq/app-shell"
import type { DashboardData } from "@/lib/sentriq/dashboard-service"
import { actionRepository } from "@/lib/actions/repository"
import { inspectionRepository } from "@/lib/inspections/repository"
import { demoActor, reviewStagesFor } from "@/lib/sentriq/demo-permissions"

type Props = { data: DashboardData; language: Language; search: string; role?: string; workspaceId?: string }
type QueueItem = { id: string; title: string; detail: string; status: string; href: string; dueAt?: string; kind: "action" | "inspection" | "follow-up" }

const copy = {
  en: {
    title: "Overview", subtitle: "Operational control center", updated: "WORKSPACE SNAPSHOT", demo: "Demo data · changes are not production records", inspections: "Awaiting review", actions: "Open actions", findings: "High-priority findings", myWork: "My work", queueDescription: "Assigned actions and reviews for your current demo role", backlogDescription: "Workspace backlog · no work is assigned to this demo role", openQueue: "Open My Work", attention: "Needs attention", attentionDescription: "Exceptions across this workspace", activity: "Recent activity", activityDescription: "Latest recorded operational events", sites: "Site summary", sitesDescription: "Inspections and open actions by location", record: "Record", owner: "Owner", status: "Status", due: "Due", site: "Site", inspectionsAtSite: "Inspections", openActions: "Open actions", noWork: "No work is assigned to this demo role.", noAttention: "No priority exceptions to review.", noActivity: "No activity is available.", noSites: "No site records are available.", viewAll: "View all", today: "Today", overdue: "Overdue", dueSoon: "Due soon", submitted: "Submitted", inReview: "In review", returned: "Returned", draft: "Draft", open: "Open", inProgress: "In progress", closureRequested: "Closure review", followUp: "Follow-up", inspection: "Inspection", action: "Action", print: "Print", siteUnit: "site", sitesUnit: "sites", activityActor: "Workspace user", searchEmpty: "No records match the current search.", personless: "No owner assigned"
  },
  ar: {
    title: "نظرة عامة", subtitle: "مركز التحكم التشغيلي", updated: "ملخص مساحة العمل", demo: "بيانات تجريبية · التغييرات ليست سجلات إنتاجية", inspections: "بانتظار المراجعة", actions: "الإجراءات المفتوحة", findings: "ملاحظات عالية الأولوية", myWork: "مساحة عملي", queueDescription: "الإجراءات والمراجعات المسندة إلى دورك التجريبي الحالي", backlogDescription: "الأعمال المعلقة في مساحة العمل · لا توجد مهام مسندة إلى هذا الدور التجريبي", openQueue: "فتح مساحة عملي", attention: "تحتاج إلى اهتمام", attentionDescription: "الاستثناءات في مساحة العمل", activity: "النشاط الأخير", activityDescription: "أحدث الأحداث التشغيلية المسجلة", sites: "ملخص المواقع", sitesDescription: "التفتيشات والإجراءات المفتوحة حسب الموقع", record: "السجل", owner: "المسؤول", status: "الحالة", due: "الاستحقاق", site: "الموقع", inspectionsAtSite: "التفتيشات", openActions: "إجراءات مفتوحة", noWork: "لا توجد أعمال مسندة إلى هذا الدور التجريبي.", noAttention: "لا توجد استثناءات ذات أولوية للمراجعة.", noActivity: "لا يتوفر نشاط حديث.", noSites: "لا تتوفر سجلات للمواقع.", viewAll: "عرض الكل", today: "اليوم", overdue: "متأخر", dueSoon: "قريب الاستحقاق", submitted: "مُقدم", inReview: "قيد المراجعة", returned: "مُعاد", draft: "مسودة", open: "مفتوح", inProgress: "قيد التنفيذ", closureRequested: "مراجعة الإغلاق", followUp: "متابعة", inspection: "تفتيش", action: "إجراء", print: "طباعة", siteUnit: "موقع", sitesUnit: "مواقع", activityActor: "مستخدم مساحة العمل", searchEmpty: "لا توجد سجلات تطابق البحث الحالي.", personless: "لم يُعيّن مسؤول"
  }
}

const statusText = (status: string, t: typeof copy.en) => ({ submitted: t.submitted, in_review: t.inReview, returned: t.returned, draft: t.draft, open: t.open, in_progress: t.inProgress, closure_requested: t.closureRequested }[status] ?? status.replaceAll("_", " "))
const formatDate = (value: string | undefined, language: Language) => value ? new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short" }).format(new Date(value)) : "—"

export function OverviewDashboard({ data: seedData, language, search, role = "company_superadmin", workspaceId }: Props) {
  const t = copy[language]
  const rtl = language === "ar"
  const term = search.trim().toLocaleLowerCase(language === "ar" ? "ar" : "en")
  const [live, setLive] = useState<{ inspections: DashboardData["inspections"]; actions: DashboardData["actions"] } | null>(null)
  const [today] = useState(() => new Date())

  useEffect(() => {
    try {
      const id = workspaceId ?? seedData.workspace.id
      setLive({ inspections: inspectionRepository.list(id) as unknown as DashboardData["inspections"], actions: actionRepository.list(id) as unknown as DashboardData["actions"] })
    } catch {
      setLive(null)
    }
  }, [workspaceId, seedData.workspace.id])

  const data = useMemo<DashboardData>(() => {
    if (!live) return seedData
    const known = new Set(seedData.findings.map((finding) => finding.id))
    const raised = (live.inspections as unknown as { id: string; workspaceId: string; findings?: { id: string; title: string; description: string; priority: "low" | "medium" | "high" | "critical" }[] }[])
      .flatMap((inspection) => (inspection.findings ?? []).filter((finding) => !known.has(finding.id)).map((finding) => ({ id: finding.id, workspaceId: inspection.workspaceId, inspectionId: inspection.id, title: finding.title, description: finding.description, priority: finding.priority, status: "open" as const })))
    return { ...seedData, inspections: live.inspections, actions: live.actions, findings: [...seedData.findings, ...raised] }
  }, [live, seedData])

  const actorId = demoActor(role).userId
  const reviewStages = reviewStagesFor(role)
  const openActions = data.actions.filter((item) => item.status !== "closed")
  const pendingReviews = data.inspections.filter((item) => ["submitted", "in_review"].includes(item.status) && item.currentStage && reviewStages.includes(item.currentStage))
  const reviewBacklog = data.inspections.filter((item) => ["submitted", "in_review"].includes(item.status))
  const highFindings = data.findings.filter((item) => item.status !== "resolved" && ["high", "critical"].includes(item.priority))

  const queue: QueueItem[] = [
    ...data.actions.filter((item) => item.ownerId === actorId && item.status !== "closed").map((item) => ({ id: item.id, title: item.title, detail: `${data.sites.find((site) => site.id === item.siteId)?.name ?? "—"} · ${t.action}`, status: item.status, href: `/app/actions/${item.id}`, dueAt: item.responseDueAt, kind: "action" as const })),
    ...data.inspections.filter((item) => item.inspectorId === actorId && ["draft", "returned"].includes(item.status)).map((item) => ({ id: item.id, title: item.title, detail: `${data.sites.find((site) => site.id === item.siteId)?.name ?? "—"} · ${t.inspection}`, status: item.status, href: `/app/inspections/${item.id}`, kind: "inspection" as const })),
    ...pendingReviews.map((item) => ({ id: item.id, title: item.title, detail: `${data.sites.find((site) => site.id === item.siteId)?.name ?? "—"} · ${item.id}`, status: item.status, href: `/app/inspections/${item.id}`, kind: "inspection" as const })),
    ...data.followUps.filter((item) => item.ownerId === actorId && !["completed", "cancelled"].includes(item.status)).map((item) => ({ id: item.id, title: item.title, detail: t.followUp, status: item.status, href: "/app/follow-ups", dueAt: item.dueAt, kind: "follow-up" as const })),
  ].filter((item) => !term || `${item.id} ${item.title} ${item.detail} ${item.status}`.toLocaleLowerCase().includes(term)).slice(0, 6)
  const workspaceBacklog: QueueItem[] = [
    ...data.inspections.filter((item) => ["submitted", "in_review", "returned"].includes(item.status)).map((item) => ({ id: item.id, title: item.title, detail: `${data.sites.find((site) => site.id === item.siteId)?.name ?? "—"} · ${item.id}`, status: item.status, href: `/app/inspections/${item.id}`, kind: "inspection" as const })),
    ...openActions.map((item) => ({ id: item.id, title: item.title, detail: `${data.sites.find((site) => site.id === item.siteId)?.name ?? "—"} · ${item.id}`, status: item.status, href: `/app/actions/${item.id}`, dueAt: item.responseDueAt, kind: "action" as const })),
  ].filter((item) => !term || `${item.id} ${item.title} ${item.detail} ${item.status}`.toLocaleLowerCase().includes(term)).slice(0, 6)
  const queueItems = queue.length ? queue : workspaceBacklog

  const attention = [
    ...data.inspections.filter((item) => ["returned", "in_review"].includes(item.status)).map((item) => ({ id: item.id, title: item.title, detail: `${item.id} · ${statusText(item.status, t)}`, href: `/app/inspections/${item.id}`, kind: "inspection" })),
    ...openActions.filter((item) => ["closure_requested", "in_progress"].includes(item.status)).map((item) => ({ id: item.id, title: item.title, detail: `${item.id} · ${statusText(item.status, t)}`, href: `/app/actions/${item.id}`, kind: "action" })),
    ...highFindings.map((item) => ({ id: item.id, title: item.title, detail: `${item.id} · ${item.priority}`, href: `/app/inspections/${item.inspectionId}`, kind: "finding" })),
  ].filter((item) => !term || `${item.title} ${item.detail}`.toLocaleLowerCase().includes(term)).slice(0, 5)

  const activity = data.auditEvents.slice().sort((a, b) => b.at.localeCompare(a.at)).filter((item) => !term || `${item.summary} ${item.recordId} ${data.users.find((user) => user.id === item.actorId)?.displayName ?? ""}`.toLocaleLowerCase().includes(term)).slice(0, 5)
  const siteRows = data.sites.map((site) => ({
    ...site,
    inspections: data.inspections.filter((item) => item.siteId === site.id).length,
    actions: openActions.filter((item) => item.siteId === site.id).length,
  })).filter((site) => !term || `${site.name} ${site.code} ${site.city}`.toLocaleLowerCase().includes(term))

  return <div className="ops-dashboard" dir={rtl ? "rtl" : "ltr"}>
    <header className="ops-page-heading">
      <div><p className="ops-breadcrumb">SENTRIQ <span>/</span> {data.workspace.name}</p><h1>{t.title}</h1><p className="ops-page-subtitle">{t.subtitle}</p></div>
      <div className="ops-heading-meta"><span className="ops-date"><CalendarDays size={15} />{new Intl.DateTimeFormat(rtl ? "ar-EG" : "en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(today)}</span><button type="button" className="ops-secondary-action ops-print-button" onClick={() => window.print()}><Printer size={15} />{t.print}</button><Link href="/app/inspections" className="ops-primary-action"><ClipboardCheck size={16} />{rtl ? "التفتيشات" : "Inspections"}</Link></div>
    </header>

    <div className="ops-data-note"><span className="ops-note-dot" />{t.demo}</div>

    <section className="ops-metrics" aria-label={rtl ? "ملخص العمليات" : "Operational summary"}>
      <div className="ops-metric"><span>{t.inspections}</span><strong>{reviewBacklog.length}</strong><Link href="/app/reviews">{rtl ? "قائمة المراجعة" : "Review queue"}<ArrowRight size={13} /></Link></div>
      <div className="ops-metric"><span>{t.actions}</span><strong>{openActions.length}</strong><Link href="/app/actions">{rtl ? "فتح الإجراءات" : "Open actions"}<ArrowRight size={13} /></Link></div>
      <div className="ops-metric"><span>{t.findings}</span><strong>{highFindings.length}</strong><Link href="/app/actions">{rtl ? "عرض الإجراءات" : "Review findings"}<ArrowRight size={13} /></Link></div>
    </section>

    <section className="ops-primary-grid">
      <article className="ops-section ops-work-section">
        <header className="ops-section-heading"><div><h2>{t.myWork}</h2><p>{queue.length ? t.queueDescription : workspaceBacklog.length ? t.backlogDescription : t.queueDescription}</p></div><Link href="/app/my-work" className="ops-section-link">{t.openQueue}<ArrowRight size={14} /></Link></header>
        {queueItems.length ? <div className="ops-work-list" role="list">
          <div className="ops-work-columns" aria-hidden="true"><span>{rtl ? "السجل" : "Record"}</span><span>{rtl ? "الحالة" : "Status"}</span><span>{rtl ? "الاستحقاق" : "Due"}</span><span /></div>
          {queueItems.map((item) => <Link className="ops-work-row" href={item.href} key={`${item.kind}-${item.id}`} role="listitem" aria-label={`${rtl ? "فتح" : "Open"} ${item.title}`}>
          <span className={`ops-row-mark ops-row-mark-${item.kind}`} aria-hidden="true">{item.kind === "action" ? <Activity size={16} /> : item.kind === "follow-up" ? <Clock3 size={16} /> : <ClipboardCheck size={16} />}</span>
          <span className="ops-work-copy"><strong>{item.title}</strong><small>{item.detail}</small></span>
          <span className={`ops-status ops-status-${item.status}`}>{statusText(item.status, t)}</span>
          <span className="ops-work-due">{item.dueAt ? formatDate(item.dueAt, language) : "—"}</span>
          <ArrowRight className="ops-row-arrow" size={15} />
        </Link>)}</div> : <div className="ops-empty"><Check size={17} /><span>{term ? t.searchEmpty : t.noWork}</span></div>}
      </article>

      <article className="ops-section ops-attention-section">
        <header className="ops-section-heading"><div><h2>{t.attention}</h2><p>{t.attentionDescription}</p></div><span className="ops-count">{attention.length}</span></header>
        {attention.length ? <ul className="ops-attention-list">{attention.map((item) => <li key={`${item.kind}-${item.id}`}><Link href={item.href} className="ops-attention-row"><span className={`ops-attention-symbol ops-attention-${item.kind}`} aria-hidden="true">{item.kind === "finding" ? <ShieldAlert size={15} /> : item.kind === "inspection" ? <ClipboardCheck size={15} /> : <CircleAlert size={15} />}</span><span><strong>{item.title}</strong><small>{item.detail}</small></span><ArrowRight className="ops-row-arrow" size={15} /></Link></li>)}</ul> : <div className="ops-empty"><Check size={17} /><span>{term ? t.searchEmpty : t.noAttention}</span></div>}
        <Link href="/app/actions" className="ops-section-footer">{t.viewAll}<ArrowRight size={14} /></Link>
      </article>
    </section>

    <section className="ops-secondary-grid">
      <article className="ops-section ops-site-section">
        <header className="ops-section-heading"><div><h2>{t.sites}</h2><p>{t.sitesDescription}</p></div><Link href="/app/organization" className="ops-section-link">{t.viewAll}<ArrowRight size={14} /></Link></header>
        {siteRows.length ? <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>{t.site}</th><th>{t.inspectionsAtSite}</th><th>{t.openActions}</th></tr></thead><tbody>{siteRows.map((site) => <tr key={site.id}><td><strong>{site.name}</strong><small>{site.code} · {site.city}</small></td><td>{site.inspections}</td><td><span className={site.actions ? "ops-site-actions has-actions" : "ops-site-actions"}>{site.actions}</span></td></tr>)}</tbody></table></div> : <div className="ops-empty"><span>{t.searchEmpty}</span></div>}
      </article>

      <article className="ops-section ops-activity-section">
        <header className="ops-section-heading"><div><h2>{t.activity}</h2><p>{t.activityDescription}</p></div><Link href="/app/audit" className="ops-section-link">{t.viewAll}<ArrowRight size={14} /></Link></header>
        {activity.length ? <ol className="ops-activity-list">{activity.map((event) => <li key={event.id}><span className="ops-activity-mark" aria-hidden="true"><ArrowDownRight size={14} /></span><div><p><strong>{data.users.find((user) => user.id === event.actorId)?.displayName ?? t.activityActor}</strong> {event.summary}</p><small>{event.recordId} · {formatDate(event.at, language)}</small></div></li>)}</ol> : <div className="ops-empty"><span>{term ? t.searchEmpty : t.noActivity}</span></div>}
      </article>
    </section>

    <footer className="ops-footer"><span>{t.updated} · {data.workspace.industryLabel}</span><span>{data.sites.length} {data.sites.length === 1 ? t.siteUnit : t.sitesUnit}</span></footer>
  </div>
}
