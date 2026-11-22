"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, CalendarClock, Check, FileText, MapPin, Paperclip, Search, UserRound } from "lucide-react"
import mockData from "@/data/mock-data.json"
import { actionRepository, daysOverdue, isActionOverdue, type ActionRecord, type ActionStatus } from "@/lib/actions/repository"
import { inspectionRepository } from "@/lib/inspections/repository"
import { can, demoActor, hasCompanyAccess } from "@/lib/sentriq/demo-permissions"
import { errorMessage, formatDate, formatDateTime, formatNumber, plural, type Language } from "@/lib/sentriq/format"
import { Dialog } from "@/components/sentriq/dialog"
import { accessFor, personName, siteName } from "@/components/sentriq/inspection-shared"
import { EmptyState, ErrorState, LoadingState, PermissionDenied, PriorityBadge, StatusBadge } from "@/components/sentriq/states"

type Filter = "all" | "assigned" | "overdue" | "closure"
const dict = {
  en: {
    title: "Findings & corrective actions", subtitle: "Every finding becomes an owned, time-bound action with evidence and verification.", eyebrow: "SENTRIQ · ACTIONS",
    all: "All", assigned: "Assigned to me", overdue: "Overdue", closure: "Closure requested", search: "Search by title, record ID or owner",
    id: "Action", site: "Site", owner: "Owner", priority: "Priority", due: "Closure due", status: "Status", back: "Corrective actions", noDue: "No due date",
    open: "Open", in_progress: "In progress", closure_requested: "Closure requested", closed: "Closed", low: "Low", medium: "Medium", high: "High", critical: "Critical",
    start: "Start work", requestClosure: "Request closure", verify: "Verify & close", returnRework: "Return for rework", overdueBy: "Overdue by",
    required: "What needs to be done", linked: "Linked records", finding: "Finding", inspection: "Inspection", timeline: "Timeline", evidence: "Evidence", noEvidence: "No evidence attached yet.",
    attach: "Attach evidence", reasonLabel: "What needs to be fixed?", reasonHint: "Be specific so the owner knows what to change (at least 5 characters).", cancel: "Cancel", confirmReturn: "Return action",
    waitingOwner: "Waiting for the action owner.", waitingVerifier: "Waiting for a verifier to close or return this action.", closedNote: "This action is closed.", ownOnly: "Only the action owner can progress this action.",
    empty: "No corrective actions yet", emptyHint: "Actions appear here when a finding is turned into a corrective action.", noMatch: "No matching actions", clear: "Clear filters",
    noAccess: "You do not have access to corrective actions", noAccessHint: "Platform operators do not see company records. Open a company workspace with a company role.",
    siteAccess: "You do not have access to this site. Contact your Company Superadmin.", unavailable: "Actions could not be loaded.", retry: "Try again", notFound: "Action not found", reload: "Reload latest",
    demo: "Demo data only — role simulation is not authorization.", created: "Action created", changed: "changed the status to", by: "by", due2: "Due", response: "Response due",
  },
  ar: {
    title: "الملاحظات والإجراءات التصحيحية", subtitle: "كل ملاحظة تتحول إلى إجراء له مسؤول وموعد وأدلة وتحقق.", eyebrow: "SENTRIQ · الإجراءات",
    all: "الكل", assigned: "مسند إليّ", overdue: "متأخر", closure: "طلب إغلاق", search: "ابحث بالعنوان أو رقم السجل أو المسؤول",
    id: "الإجراء", site: "الموقع", owner: "المسؤول", priority: "الأولوية", due: "موعد الإغلاق", status: "الحالة", back: "الإجراءات التصحيحية", noDue: "بلا موعد",
    open: "مفتوح", in_progress: "قيد التنفيذ", closure_requested: "طلب إغلاق", closed: "مغلق", low: "منخفضة", medium: "متوسطة", high: "عالية", critical: "حرجة",
    start: "بدء العمل", requestClosure: "طلب الإغلاق", verify: "تحقق وإغلاق", returnRework: "إعادة للتصحيح", overdueBy: "متأخر بمقدار",
    required: "المطلوب تنفيذه", linked: "السجلات المرتبطة", finding: "الملاحظة", inspection: "التفتيش", timeline: "التسلسل الزمني", evidence: "الأدلة", noEvidence: "لم تُرفق أدلة بعد.",
    attach: "إرفاق دليل", reasonLabel: "ما الذي يجب إصلاحه؟", reasonHint: "كن محددًا ليعرف المسؤول ما يجب تغييره (5 أحرف على الأقل).", cancel: "إلغاء", confirmReturn: "إعادة الإجراء",
    waitingOwner: "بانتظار مسؤول الإجراء.", waitingVerifier: "بانتظار مراجع مخوّل لإغلاق الإجراء أو إعادته.", closedNote: "هذا الإجراء مغلق.", ownOnly: "مسؤول الإجراء فقط يمكنه تحريك هذا الإجراء.",
    empty: "لا توجد إجراءات تصحيحية بعد", emptyHint: "تظهر الإجراءات هنا عندما تتحول ملاحظة إلى إجراء تصحيحي.", noMatch: "لا توجد إجراءات مطابقة", clear: "مسح التصفية",
    noAccess: "ليس لديك صلاحية الوصول إلى الإجراءات التصحيحية", noAccessHint: "مشغلو المنصة لا يرون سجلات الشركات. افتح مساحة شركة بدور شركة.",
    siteAccess: "ليس لديك حق الوصول إلى هذا الموقع. تواصل مع مسؤول الشركة.", unavailable: "تعذر تحميل الإجراءات.", retry: "إعادة المحاولة", notFound: "الإجراء غير موجود", reload: "إعادة تحميل الأحدث",
    demo: "بيانات تجريبية فقط — محاكاة الأدوار لا تمثل صلاحيات فعلية.", created: "تم إنشاء الإجراء", changed: "غيّر الحالة إلى", by: "بواسطة", due2: "الاستحقاق", response: "موعد الاستجابة",
  },
} as const
type Dict = (typeof dict)[Language]

const statusLabel = (status: string, t: Dict) => (t as unknown as Record<string, string>)[status] ?? status
const priorityLabel = (priority: string, t: Dict) => (t as unknown as Record<string, string>)[priority] ?? priority

export function Actions({ route, language = "en", workspaceId = "ws_northstar", role = "inspector" }: { route: string; language?: Language; workspaceId?: string; role?: string }) {
  const t = dict[language]
  const rtl = language === "ar"
  const access = accessFor(role)
  const actionId = route.split("/").filter(Boolean)[2]
  const [records, setRecords] = useState<ActionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const refresh = useCallback(() => { try { setRecords(actionRepository.list(workspaceId)); setFailed(false) } catch { setFailed(true) } finally { setLoading(false) } }, [workspaceId])
  useEffect(() => { refresh() }, [refresh])
  const wrap = { dir: rtl ? "rtl" : "ltr" } as const

  if (!hasCompanyAccess(role)) return <section className="inspection-page" {...wrap}><PermissionDenied title={t.noAccess} reason={t.noAccessHint} backHref="/app/dashboard" backLabel={rtl ? "العودة إلى النظرة العامة" : "Back to overview"} /></section>
  if (loading) return <section className="inspection-page" aria-busy="true" {...wrap}><p className="eyebrow">{t.eyebrow}</p><h1>{t.title}</h1><LoadingState label={t.title} /></section>
  if (failed) return <section className="inspection-page" {...wrap}><ErrorState title={t.unavailable} onRetry={() => { setLoading(true); refresh() }} retryLabel={t.retry} /></section>

  const scoped = records.filter((item) => item.workspaceId === workspaceId && access.siteIds.includes(item.siteId))
  if (actionId) {
    const record = records.find((item) => item.id === actionId)
    if (!record) return <section className="inspection-page" {...wrap}><EmptyState title={t.notFound} action={<Link className="button-outline" href="/app/actions">{t.back}</Link>} /></section>
    if (!access.siteIds.includes(record.siteId)) return <section className="inspection-page" {...wrap}><PermissionDenied title={t.siteAccess} reason={t.siteAccess} backHref="/app/actions" backLabel={t.back} /></section>
    return <ActionDetail record={record} language={language} role={role} onChange={refresh} />
  }
  return <ActionList records={scoped} language={language} role={role} />
}

function ActionList({ records, language, role }: { records: ActionRecord[]; language: Language; role: string }) {
  const t = dict[language]
  const actor = demoActor(role)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const matchers: Record<Filter, (item: ActionRecord) => boolean> = { all: () => true, assigned: (item) => item.ownerId === actor.userId, overdue: (item) => isActionOverdue(item), closure: (item) => item.status === "closure_requested" }
  const counts = Object.fromEntries((Object.keys(matchers) as Filter[]).map((key) => [key, records.filter(matchers[key]).length])) as Record<Filter, number>
  const visible = useMemo(() => records.filter((item) => matchers[filter](item) && `${item.id} ${item.title} ${personName(item.ownerId)}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => (a.closureDueAt ?? "9999").localeCompare(b.closureDueAt ?? "9999")), [records, filter, query]) // eslint-disable-line react-hooks/exhaustive-deps
  const chips: { id: Filter; text: string }[] = [{ id: "all", text: t.all }, { id: "assigned", text: t.assigned }, { id: "overdue", text: t.overdue }, { id: "closure", text: t.closure }]
  return <section className="inspection-page" dir={language === "ar" ? "rtl" : "ltr"}>
    <div className="inspection-heading"><div><p className="eyebrow">{t.eyebrow}</p><h1>{t.title}</h1><p>{t.subtitle}</p></div></div>
    <div className="ux-summary" role="group" aria-label={t.title}>{[{ id: "overdue" as Filter, label: t.overdue, tone: "overdue" }, { id: "closure" as Filter, label: t.closure, tone: "review" }, { id: "assigned" as Filter, label: t.assigned, tone: "mine" }, { id: "all" as Filter, label: t.all, tone: "returned" }].map((item) => <button type="button" key={item.id} className={`ux-summary-card ux-summary-${item.tone}${filter === item.id ? " is-active" : ""}`} aria-pressed={filter === item.id} onClick={() => setFilter(filter === item.id && item.id !== "all" ? "all" : item.id)}><strong>{formatNumber(counts[item.id], language)}</strong><span>{item.label}</span></button>)}</div>
    <div className="inspection-toolbar"><label className="inspection-search"><Search size={16} aria-hidden="true" /><input aria-label={t.search} placeholder={t.search} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <div className="inspection-filter-tabs" role="group" aria-label={t.status}>{chips.map((item) => <button type="button" key={item.id} className={filter === item.id ? "active" : ""} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.text}<span className="ux-count">{formatNumber(counts[item.id], language)}</span></button>)}</div></div>
    <div className="inspection-table-scroll" tabIndex={0} role="region" aria-label={t.title}>
      <table className="inspection-table"><caption className="sr-only">{t.title}</caption>
        <thead><tr><th scope="col">{t.id}</th><th scope="col">{t.site}</th><th scope="col">{t.owner}</th><th scope="col">{t.priority}</th><th scope="col">{t.due}</th><th scope="col">{t.status}</th></tr></thead>
        <tbody>{visible.map((item) => { const late = isActionOverdue(item); return <tr key={item.id}>
          <td className="ux-c-title" data-label={t.id}><Link className="inspection-record-title" href={`/app/actions/${item.id}`}>{item.title}</Link><span className="ux-cell-sub">{item.id}</span></td>
          <td data-label={t.site}>{siteName(item.siteId)}</td><td data-label={t.owner}>{personName(item.ownerId)}</td>
          <td data-label={t.priority}><PriorityBadge priority={item.priority} label={priorityLabel(item.priority, t)} /></td>
          <td data-label={t.due}>{item.closureDueAt ? <span className={late ? "ux-due is-overdue" : "ux-due"}>{formatDate(item.closureDueAt, language)}{late && ` · ${t.overdueBy} ${plural(language, "day", daysOverdue(item))}`}</span> : <span className="ux-muted">{t.noDue}</span>}</td>
          <td className="ux-c-status" data-label={t.status}><StatusBadge status={item.status} label={statusLabel(item.status, t)} /></td></tr> })}</tbody></table>
      {!visible.length && <EmptyState title={query || filter !== "all" ? t.noMatch : t.empty} hint={query || filter !== "all" ? undefined : t.emptyHint} action={query || filter !== "all" ? <button type="button" className="button-outline" onClick={() => { setQuery(""); setFilter("all") }}>{t.clear}</button> : undefined} />}
    </div>
    <p className="inspection-demo-note">{t.demo}</p>
  </section>
}

function ActionDetail({ record, language, role, onChange }: { record: ActionRecord; language: Language; role: string; onChange: () => void }) {
  const t = dict[language]
  const actor = demoActor(role)
  const isOwner = record.ownerId === actor.userId && can(role, "actions.update_assigned")
  const canVerify = can(role, "actions.verify") && record.ownerId !== actor.userId
  const [returning, setReturning] = useState(false)
  const [reason, setReason] = useState("")
  const [message, setMessage] = useState("")
  const late = isActionOverdue(record)
  const inspection = useMemo(() => { try { return inspectionRepository.get(record.inspectionId) } catch { return undefined } }, [record.inspectionId])
  const finding = inspection?.findings?.find((item) => item.id === record.findingId) ?? mockData.findings.find((item) => item.id === record.findingId)

  const move = (to: ActionStatus, withReason?: string) => {
    try { actionRepository.transition(record.id, { to, actorId: actor.userId, canVerify, expectedRevision: record.revision, reason: withReason }); setMessage(""); setReturning(false); setReason(""); onChange() } catch (error) { setMessage(errorMessage(language, error)) }
  }
  const attach = (files: FileList | null) => {
    if (!files?.length) return
    try { actionRepository.attachEvidence(record.id, Array.from(files).map((file) => file.name), record.revision); onChange() } catch (error) { setMessage(errorMessage(language, error)) }
  }

  const primary = record.status === "open" && isOwner ? { label: t.start, to: "in_progress" as ActionStatus }
    : record.status === "in_progress" && isOwner ? { label: t.requestClosure, to: "closure_requested" as ActionStatus }
    : record.status === "closure_requested" && canVerify ? { label: t.verify, to: "closed" as ActionStatus } : null
  const waiting = !primary && (record.status === "closed" ? t.closedNote : record.status === "closure_requested" ? t.waitingVerifier : isOwner ? "" : t.waitingOwner)

  return <section className="inspection-page" dir={language === "ar" ? "rtl" : "ltr"}>
    <Link href="/app/actions" className="inspection-back"><ArrowLeft size={16} aria-hidden="true" />{t.back}</Link>
    <div className="inspection-detail-heading"><div><p className="eyebrow">{record.id}</p><h1>{record.title}</h1><p>{siteName(record.siteId)}</p></div><StatusBadge status={record.status} label={statusLabel(record.status, t)} /></div>
    <div className="inspection-meta-grid">
      <div className="inspection-meta"><span><UserRound size={15} />{t.owner}</span><strong>{personName(record.ownerId)}</strong></div>
      <div className="inspection-meta"><span><MapPin size={15} />{t.site}</span><strong>{siteName(record.siteId)}</strong></div>
      <div className={`inspection-meta${late ? " is-danger" : ""}`}><span><CalendarClock size={15} />{t.due}</span><strong>{record.closureDueAt ? formatDate(record.closureDueAt, language) : t.noDue}</strong>{late && <em className="ux-overdue-note">{t.overdueBy} {plural(language, "day", daysOverdue(record))}</em>}</div>
      <div className="inspection-meta"><span><Check size={15} />{t.priority}</span><PriorityBadge priority={record.priority} label={priorityLabel(record.priority, t)} /></div>
    </div>

    <div className="inspection-panel">
      <h2>{t.required}</h2>
      <p className="ux-body">{record.description || "—"}</p>
      {record.responseDueAt && <p className="ux-muted">{t.response}: {formatDate(record.responseDueAt, language)}</p>}
      <div className="ux-action-bar">
        {primary && <button type="button" className="button-primary" onClick={() => move(primary.to)}>{primary.label}</button>}
        {record.status === "closure_requested" && canVerify && <button type="button" className="button-outline" onClick={() => { setReturning(true); setMessage("") }}>{t.returnRework}</button>}
        {waiting && <p className="ux-waiting" role="status">{waiting}</p>}
      </div>
      {message && <p role="alert" className="inspection-alert">{message}</p>}
    </div>

    <div className="ux-two-col">
      <div className="inspection-panel"><h2>{t.linked}</h2>
        <ul className="ux-links">
          <li><FileText size={15} aria-hidden="true" /><span>{t.finding}</span><strong>{finding?.title ?? record.findingId}</strong></li>
          <li><FileText size={15} aria-hidden="true" /><span>{t.inspection}</span><Link className="ux-link" href={`/app/inspections/${record.inspectionId}#findings`}>{record.inspectionId}</Link></li></ul>
        <h2 className="ux-sub">{t.evidence}</h2>
        {(record.evidenceNames?.length ?? 0) > 0 ? <ul className="ux-links">{record.evidenceNames?.map((name, index) => <li key={`${name}-${index}`}><Paperclip size={15} aria-hidden="true" /><strong>{name}</strong></li>)}</ul> : <p className="ux-muted">{t.noEvidence}</p>}
        {isOwner && ["open", "in_progress"].includes(record.status) && <label className="runner-file ux-attach"><Paperclip size={16} aria-hidden="true" /><span>{t.attach}</span><input type="file" multiple aria-label={t.attach} onChange={(event) => attach(event.target.files)} /></label>}
      </div>
      <div className="inspection-panel"><h2>{t.timeline}</h2>
        <ol className="inspection-history">{[...record.updates].reverse().map((update) => <li key={update.id}><strong>{update.from ? `${statusLabel(update.from, t)} → ${statusLabel(update.to, t)}` : t.created}</strong><span>{personName(update.actorId) !== "—" ? personName(update.actorId) : update.actorId}{update.note ? ` — ${update.note}` : ""}</span><time dateTime={update.at}>{formatDateTime(update.at, language)}</time></li>)}{record.updates.length === 0 && <li><strong>{t.created}</strong><span>{record.id}</span></li>}</ol></div>
    </div>
    <p className="inspection-demo-note">{t.demo}</p>
    {returning && <Dialog title={t.returnRework} closeLabel={t.cancel} onClose={() => setReturning(false)}>
      <label>{t.reasonLabel}<textarea data-autofocus rows={4} value={reason} onChange={(event) => setReason(event.target.value)} aria-describedby="rework-hint" /></label>
      <p id="rework-hint" className="ux-dialog-hint">{t.reasonHint}</p>
      {message && <p role="alert" className="inspection-alert">{message}</p>}
      <div className="inspection-modal-actions"><button type="button" className="button-outline" onClick={() => setReturning(false)}>{t.cancel}</button><button type="button" className="button-primary" onClick={() => move("in_progress", reason)}>{t.confirmReturn}</button></div>
    </Dialog>}
  </section>
}
