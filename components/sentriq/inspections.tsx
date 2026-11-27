"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, Check, ClipboardCheck, Clock3, FilePlus2, MapPin, Plus, Search, ShieldCheck, UserRound } from "lucide-react"
import { actionRepository, type ActionRecord } from "@/lib/actions/repository"
import { inspectionRepository, isOverdue, reviewStagesOf, type InspectionFinding, type InspectionRecord, type InspectionStatus } from "@/lib/inspections/repository"
import { can, demoActor, reviewStagesFor } from "@/lib/sentriq/demo-permissions"
import { completedLabel, errorMessage, formatDate, formatDateTime, formatNumber, plural, stageLabel, type Language } from "@/lib/sentriq/format"
import { words } from "@/lib/sentriq/inspections-i18n"
import { Dialog } from "@/components/sentriq/dialog"
import { InspectionRunner } from "@/components/sentriq/inspection-runner"
import { accessFor, getTemplates, isAnswered, mayExecute, people, personName, questionLabel, siteName, siteRows, type Template } from "@/components/sentriq/inspection-shared"
import { EmptyState, ErrorState, LoadingState, PermissionDenied, PriorityBadge, StatusBadge, Stepper } from "@/components/sentriq/states"

type Props = { route: string; language?: Language; workspaceId?: string; role?: string }
type Filter = "all" | "assigned" | "inReview" | "returned" | "overdue"

const statusKey = (item: Pick<InspectionRecord, "status" | "dueAt">): string => (isOverdue(item) ? "overdue" : item.status)
function statusText(status: string, language: Language) {
  const t = words[language]
  const map: Record<string, string> = { draft: t.draft, in_progress: t.in_progress, submitted: t.submittedStatus, in_review: t.in_review, approved: t.approved, returned: t.returnedStatus, scheduled: t.scheduled, cancelled: t.cancelled, overdue: t.overdue }
  return map[status] ?? status
}
const priorityText = (priority: string, language: Language) => (language === "ar" ? ({ low: "منخفضة", medium: "متوسطة", high: "عالية", critical: "حرجة" } as Record<string, string>)[priority] : priority.charAt(0).toUpperCase() + priority.slice(1)) ?? priority

export function Inspections({ route, language = "en", workspaceId = "ws_northstar", role = "inspector" }: Props) {
  const t = words[language]
  const rtl = language === "ar"
  const access = accessFor(role)
  const segments = route.split("/").filter(Boolean)
  const inReviews = segments[1] === "reviews"
  const inspectionId = segments[2]
  const isRunner = !inReviews && segments.at(-1) === "run" && Boolean(inspectionId)
  const isDetail = Boolean(inspectionId) && !isRunner
  const isReviewList = inReviews && !inspectionId

  const [records, setRecords] = useState<InspectionRecord[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [record, setRecord] = useState<InspectionRecord | undefined>()
  const [ready, setReady] = useState(false)
  // Keeps the runner mounted after a successful submit so the confirmation screen can show.
  const [runnerLock, setRunnerLock] = useState<string | null>(null)

  const refresh = useCallback(() => {
    try { setTemplates(getTemplates()); setRecords(inspectionRepository.list(workspaceId)); setFailed(false) } catch { setFailed(true) } finally { setLoading(false) }
  }, [workspaceId])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    if (!inspectionId) { setRecord(undefined); setReady(true); return }
    try { setRecord(inspectionRepository.get(inspectionId)) } catch { setFailed(true) }
    setReady(true)
  }, [inspectionId, records])

  const onRecordChange = (next: InspectionRecord) => { if (isRunner) setRunnerLock(next.id); setRecord(next); refresh() }
  const wrapperProps = { dir: rtl ? "rtl" : "ltr" } as const
  const pageTitle = inReviews ? t.reviews : t.inspections

  if (!access.canRead) return <section className="inspection-page" {...wrapperProps}><PermissionDenied title={t.noInspectionAccess} reason={t.noInspectionAccessHint} backHref="/app/dashboard" backLabel={language === "ar" ? "العودة إلى النظرة العامة" : "Back to overview"} /></section>
  if (inReviews && reviewStagesFor(role).length === 0) return <section className="inspection-page" {...wrapperProps}><PermissionDenied title={t.noReviewerRole} reason={t.noReviewerRoleHint} backHref="/app/inspections" backLabel={t.inspections} /></section>
  if (loading || !ready) return <section className="inspection-page" aria-busy="true" {...wrapperProps}><p className="eyebrow">SENTRIQ · {t.inspections}</p><h1>{pageTitle}</h1><LoadingState label={t.inspections} /></section>
  if (failed) return <section className="inspection-page" {...wrapperProps}><ErrorState title={t.unavailable} onRetry={() => { setLoading(true); refresh() }} retryLabel={t.retry} /></section>

  if ((isRunner || isDetail) && !record) return <section className="inspection-page" {...wrapperProps}><EmptyState title={t.unavailable} action={<Link className="button-outline" href="/app/inspections">{t.backWork}</Link>} /></section>
  if (record && (isRunner || isDetail) && !access.siteIds.includes(record.siteId)) return <section className="inspection-page" {...wrapperProps}><PermissionDenied title={t.siteAccess} reason={t.siteAccess} backHref="/app/inspections" backLabel={t.backWork} /></section>
  const currentTemplate = templates.find((template) => template.id === record?.templateId)

  if (isRunner && record) {
    if (!mayExecute(role, record) && runnerLock !== record.id) return <section className="inspection-page" {...wrapperProps}><PermissionDenied title={language === "ar" ? "لا يمكنك تنفيذ هذا التفتيش" : "You cannot carry out this inspection"} reason={language === "ar" ? "يمكن للمفتش المسند إليه التفتيش فقط تنفيذه وهو مسودة أو مُعاد." : "Only the assigned inspector can fill in this inspection while it is a draft or returned."} backHref={`/app/inspections/${record.id}`} backLabel={t.viewInspection} /></section>
    return <InspectionRunner userId={access.actor.userId} record={record} template={currentTemplate} language={language} onChange={onRecordChange} onExit={() => { window.location.href = `/app/inspections/${record.id}` }} />
  }
  if (isDetail && record) return <InspectionDetail record={record} template={currentTemplate} language={language} role={role} fromReviews={inReviews} onChange={onRecordChange} />
  return <InspectionList records={records} templates={templates} language={language} role={role} workspaceId={workspaceId} reviewList={isReviewList} />
}

/* ------------------------------------------------------------------ list */

function InspectionList({ records, templates, language, role, workspaceId, reviewList }: { records: InspectionRecord[]; templates: Template[]; language: Language; role: string; workspaceId: string; reviewList: boolean }) {
  const t = words[language]
  const access = accessFor(role)
  const stagesForRole = reviewStagesFor(role)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [newOpen, setNewOpen] = useState(false)

  const scoped = useMemo(() => records.filter((item) => item.workspaceId === workspaceId && access.siteIds.includes(item.siteId)), [records, workspaceId, access.siteIds])
  const base = reviewList ? scoped.filter((item) => ["submitted", "in_review"].includes(item.status) && item.currentStage && stagesForRole.includes(item.currentStage)) : scoped
  const matchers: Record<Filter, (item: InspectionRecord) => boolean> = {
    all: () => true,
    assigned: (item) => item.inspectorId === access.actor.userId,
    inReview: (item) => ["submitted", "in_review"].includes(item.status),
    returned: (item) => item.status === "returned",
    overdue: (item) => isOverdue(item),
  }
  const counts = Object.fromEntries((Object.keys(matchers) as Filter[]).map((key) => [key, base.filter(matchers[key]).length])) as Record<Filter, number>
  const visible = base.filter((item) => matchers[filter](item) && `${item.id} ${item.title} ${siteName(item.siteId)}`.toLowerCase().includes(query.trim().toLowerCase()))
  const filterItems: { id: Filter; text: string }[] = reviewList ? [{ id: "all", text: t.all }, { id: "overdue", text: t.overdue }] : [{ id: "all", text: t.all }, { id: "assigned", text: t.assigned }, { id: "inReview", text: t.inReview }, { id: "returned", text: t.returned }, { id: "overdue", text: t.overdue }]
  const summary = [
    { id: "inReview" as Filter, label: t.awaitingReview, value: counts.inReview, tone: "review" },
    { id: "returned" as Filter, label: t.returned, value: counts.returned, tone: "returned" },
    { id: "overdue" as Filter, label: t.overdue, value: counts.overdue, tone: "overdue" },
    { id: "assigned" as Filter, label: t.yourInspections, value: counts.assigned, tone: "mine" },
  ]

  return <section className="inspection-page" dir={language === "ar" ? "rtl" : "ltr"}>
    <div className="inspection-heading"><div><p className="eyebrow">SENTRIQ · QHSE</p><h1>{reviewList ? t.reviews : t.inspections}</h1><p>{reviewList ? t.reviewInboxHint : t.subtitle}</p></div>
      {!reviewList && access.canCreate && <button type="button" className="button-primary" onClick={() => setNewOpen(true)}><FilePlus2 size={16} aria-hidden="true" />{t.new}</button>}</div>

    {!reviewList && <div className="ux-summary" role="group" aria-label={t.summary}>{summary.map((item) => <button type="button" key={item.id} className={`ux-summary-card ux-summary-${item.tone}${filter === item.id ? " is-active" : ""}`} aria-pressed={filter === item.id} onClick={() => setFilter(filter === item.id ? "all" : item.id)}><strong>{formatNumber(item.value, language)}</strong><span>{item.label}</span></button>)}</div>}

    <div className="inspection-toolbar"><label className="inspection-search"><Search size={16} aria-hidden="true" /><input aria-label={t.search} placeholder={t.searchFilter} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <div className="inspection-filter-tabs" role="group" aria-label={t.status}>{filterItems.map((item) => <button type="button" key={item.id} className={filter === item.id ? "active" : ""} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.text}<span className="ux-count">{formatNumber(counts[item.id], language)}</span></button>)}</div></div>

    <div className="inspection-table-scroll" tabIndex={0} role="region" aria-label={reviewList ? t.reviews : t.inspections}>
      <table className="inspection-table"><caption className="sr-only">{reviewList ? t.reviews : t.inspections}</caption>
        <thead><tr><th scope="col">{t.id}</th><th scope="col">{t.form}</th><th scope="col">{t.inspector}</th><th scope="col">{t.stage}</th><th scope="col">{t.dueDate}</th><th scope="col">{t.updated}</th><th scope="col">{t.status}</th></tr></thead>
        <tbody>{visible.map((item) => <tr key={item.id}>
          <td className="ux-c-id" data-label={t.id}><Link href={reviewList ? `/app/reviews/${item.id}` : `/app/inspections/${item.id}`} className="inspection-record-id">{item.id}</Link></td>
          <td className="ux-c-title" data-label={t.form}><Link href={reviewList ? `/app/reviews/${item.id}` : `/app/inspections/${item.id}`} className="inspection-record-title">{item.title}</Link><span className="ux-cell-sub"><MapPin size={12} aria-hidden="true" />{siteName(item.siteId)}</span></td>
          <td data-label={t.inspector}>{personName(item.inspectorId)}</td>
          <td data-label={t.stage}><StageCell record={item} language={language} /></td>
          <td data-label={t.dueDate}>{item.dueAt ? <span className={isOverdue(item) ? "ux-due is-overdue" : "ux-due"}>{formatDate(item.dueAt, language)}</span> : <span className="ux-muted">—</span>}</td>
          <td data-label={t.updated}>{formatDate(item.updatedAt, language)}</td>
          <td className="ux-c-status" data-label={t.status}><StatusBadge status={statusKey(item)} label={statusText(statusKey(item), language)} /></td></tr>)}</tbody></table>
      {!visible.length && <EmptyState title={query || filter !== "all" ? (language === "ar" ? "لا توجد نتائج مطابقة" : "No matching inspections") : t.empty} hint={query || filter !== "all" ? undefined : t.emptyHint} action={query || filter !== "all" ? <button type="button" className="button-outline" onClick={() => { setQuery(""); setFilter("all") }}>{t.clear}</button> : !reviewList && access.canCreate ? <button type="button" className="button-primary" onClick={() => setNewOpen(true)}>{t.new}</button> : undefined} />}
    </div>
    <p className="inspection-demo-note">{t.demo}</p>
    {newOpen && <NewInspectionDialog templates={templates} language={language} role={role} workspaceId={workspaceId} onClose={() => setNewOpen(false)} />}
  </section>
}

function StageCell({ record, language }: { record: InspectionRecord; language: Language }) {
  const stages = reviewStagesOf(record)
  if (record.status === "approved") return <span className="ux-stage-done">{completedLabel(language)}</span>
  if (!record.currentStage) return <span className="ux-muted">—</span>
  const index = stages.indexOf(record.currentStage)
  return <span className="ux-stage" aria-label={`${stageLabel(language, record.currentStage)} (${index + 1}/${stages.length})`}><span className="ux-stage-dots" aria-hidden="true">{stages.map((stage, i) => <i key={stage} className={i < index ? "done" : i === index ? "current" : ""} />)}</span>{stageLabel(language, record.currentStage)}</span>
}

function NewInspectionDialog({ templates, language, role, workspaceId, onClose }: { templates: Template[]; language: Language; role: string; workspaceId: string; onClose: () => void }) {
  const t = words[language]
  const access = accessFor(role)
  const sites = siteRows.filter((site) => site.workspaceId === workspaceId && access.siteIds.includes(site.id))
  const [formId, setFormId] = useState(templates[0]?.id ?? "")
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "")
  const [dueAt, setDueAt] = useState("")
  const [error, setError] = useState("")
  const create = () => {
    const template = templates.find((item) => item.id === formId)
    if (!template || !siteId) return
    try {
      const created = inspectionRepository.create({ workspaceId, siteId, templateId: template.id, templateVersion: template.version, title: template.title[language], inspectorId: access.actor.userId, dueAt: dueAt || undefined })
      window.location.href = `/app/inspections/${created.id}/run`
    } catch (caught) { setError(errorMessage(language, caught)) }
  }
  return <Dialog title={t.create} closeLabel={t.cancel} onClose={onClose}>
    <p className="ux-dialog-hint">{t.newHint}</p>
    <label>{t.chooseForm}<select data-autofocus value={formId} onChange={(event) => setFormId(event.target.value)}>{templates.map((template) => <option key={template.id} value={template.id}>{template.title[language]} · v{template.version}</option>)}</select></label>
    <label>{t.chooseSite}<select value={siteId} onChange={(event) => setSiteId(event.target.value)}>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
    <label>{t.due}<input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>
    {error && <p role="alert" className="inspection-alert">{error}</p>}
    <div className="inspection-modal-actions"><button type="button" className="button-outline" onClick={onClose}>{t.cancel}</button><button type="button" className="button-primary" disabled={!formId || !siteId} onClick={create}>{t.create}</button></div>
  </Dialog>
}

/* ---------------------------------------------------------------- detail */

type Tab = "overview" | "answers" | "findings" | "history" | "audit"

function InspectionDetail({ record, template, language, role, fromReviews, onChange }: { record: InspectionRecord; template?: Template; language: Language; role: string; fromReviews: boolean; onChange: (record: InspectionRecord) => void }) {
  const t = words[language]
  const rtl = language === "ar"
  const access = accessFor(role)
  const [tab, setTab] = useState<Tab>("overview")
  useEffect(() => {
    const sync = () => { if (window.location.hash === "#findings") setTab("findings") }
    sync()
    window.addEventListener("hashchange", sync)
    return () => window.removeEventListener("hashchange", sync)
  }, [])
  const [actions, setActions] = useState<ActionRecord[]>([])
  const loadActions = useCallback(() => { try { setActions(actionRepository.listForInspection(record.id)) } catch { setActions([]) } }, [record.id])
  useEffect(() => { loadActions() }, [loadActions])

  const stages = reviewStagesOf(record)
  const cycle = record.cycle ?? 0
  const doneStages = record.status === "approved" ? stages : record.reviewHistory.filter((entry) => entry.decision === "approved" && (entry.cycle ?? 0) === cycle).map((entry) => entry.stage)
  const questions = template?.snapshot.questions.filter((question) => question.type !== "instruction") ?? []
  const answered = questions.filter((question) => isAnswered(record.answers.find((answer) => answer.questionId === question.id)?.value)).length
  const tabs: { key: Tab; text: string }[] = [{ key: "overview", text: t.details }, { key: "answers", text: t.answers }, { key: "findings", text: t.findings }, { key: "history", text: t.history }, { key: "audit", text: t.audit }]

  return <section className="inspection-page" dir={rtl ? "rtl" : "ltr"}>
    <Link href={fromReviews ? "/app/reviews" : "/app/inspections"} className="inspection-back"><ArrowLeft size={16} aria-hidden="true" />{fromReviews ? t.reviews : t.inspections}</Link>
    <div className="inspection-detail-heading"><div><p className="eyebrow">{record.id} · v{record.templateVersion}</p><h1>{record.title}</h1><p>{siteName(record.siteId)} · {template?.title[language] ?? record.templateId}</p></div><StatusBadge status={statusKey(record)} label={statusText(statusKey(record), language)} /></div>
    <div className="inspection-meta-grid">
      <Meta icon={<MapPin size={15} />} label={t.site} value={siteName(record.siteId)} />
      <Meta icon={<UserRound size={15} />} label={t.inspector} value={personName(record.inspectorId)} />
      <Meta icon={<Clock3 size={15} />} label={t.dueDate} value={record.dueAt ? formatDate(record.dueAt, language) : t.noDue} tone={isOverdue(record) ? "danger" : undefined} />
      <Meta icon={<ClipboardCheck size={15} />} label={t.stage} value={record.status === "approved" ? completedLabel(language) : record.currentStage ? stageLabel(language, record.currentStage) : statusText(record.status, language)} />
    </div>
    <div className="inspection-tabs" role="tablist" aria-label={t.details}>{tabs.map((item) => <button type="button" key={item.key} id={`tab-${item.key}`} role="tab" aria-selected={tab === item.key} aria-controls="inspection-tabpanel" tabIndex={tab === item.key ? 0 : -1} onClick={() => setTab(item.key)} onKeyDown={(event) => { const order = tabs.map((entry) => entry.key); const at = order.indexOf(tab); const step = event.key === "ArrowRight" ? (rtl ? -1 : 1) : event.key === "ArrowLeft" ? (rtl ? 1 : -1) : 0; if (step) { event.preventDefault(); const next = order[(at + step + order.length) % order.length]; setTab(next); document.getElementById(`tab-${next}`)?.focus() } }}>{item.text}{item.key === "findings" && (record.findings?.length ?? 0) > 0 && <span className="ux-count">{formatNumber(record.findings?.length ?? 0, language)}</span>}</button>)}</div>

    <div className="inspection-panel" id="inspection-tabpanel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
      {tab === "overview" && <>
        <h2>{t.details}</h2>
        <Stepper steps={stages.map((stage) => ({ id: stage, label: stageLabel(language, stage) }))} current={record.currentStage} done={doneStages} />
        <dl className="ux-overview-stats"><div><dt>{t.answered}</dt><dd>{formatNumber(answered, language)}/{formatNumber(questions.length, language)}</dd></div><div><dt>{t.findingsTab}</dt><dd>{plural(language, "finding", record.findings?.length ?? 0)}</dd></div><div><dt>{t.actionsLinked}</dt><dd>{plural(language, "action", actions.length)}</dd></div></dl>
        {mayExecute(role, record) && <Link className="button-primary" href={`/app/inspections/${record.id}/run`}>{record.status === "draft" && record.answers.length === 0 ? t.run : t.continue}</Link>}
        <ReviewPanel record={record} language={language} role={role} onChange={onChange} />
      </>}
      {tab === "answers" && <><h2>{t.answers}</h2>{questions.length ? questions.map((question) => <div className="inspection-answer-row" key={question.id}><strong>{questionLabel(question, language)}</strong><span>{formatAnswer(question, record.answers.find((answer) => answer.questionId === question.id)?.value, language)}</span></div>) : <p>{t.noQuestions}</p>}</>}
      {tab === "findings" && <FindingsTab record={record} actions={actions} language={language} role={role} canCreate={can(role, "actions.create") && access.siteIds.includes(record.siteId)} onCreated={loadActions} />}
      {tab === "history" && <><h2>{t.history}</h2>{record.reviewHistory.length ? <ol className="inspection-history">{[...record.reviewHistory].reverse().map((entry) => <li key={entry.id}><strong>{entry.decision === "approved" ? t.approve : t.return} · {stageLabel(language, entry.stage)}</strong><span>{personName(entry.actorId) !== "—" ? personName(entry.actorId) : demoActorLabel(entry.actorId)}{entry.reason ? ` — ${entry.reason}` : ""}</span><time dateTime={entry.at}>{formatDateTime(entry.at, language)}</time></li>)}</ol> : <p>{t.noHistory}</p>}</>}
      {tab === "audit" && <AuditTab record={record} language={language} />}
    </div>
    <p className="inspection-demo-note">{t.demo}</p>
  </section>
}

const demoActorLabel = (userId: string) => ["inspector", "reviewer_1", "reviewer_2", "final_reviewer", "company_admin"].map((role) => demoActor(role)).find((actor) => actor.userId === userId)?.label ?? userId

function Meta({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "danger" }) {
  return <div className={`inspection-meta${tone ? ` is-${tone}` : ""}`}><span>{icon}{label}</span><strong>{value}</strong></div>
}

function formatAnswer(question: { type: string; config: { choices?: { id: string; label: { en: string; ar: string } }[] } }, value: unknown, language: Language) {
  const t = words[language]
  if (!isAnswered(value)) return "—"
  if (typeof value === "boolean") return value ? t.yes : t.no
  if (question.type === "single_select" || question.type === "multi_select") return (Array.isArray(value) ? value : [value]).map((id) => question.config.choices?.find((choice) => choice.id === id)?.label[language] ?? String(id)).join(", ")
  if (Array.isArray(value)) return value.map((file) => (typeof file === "string" ? file : (file as File).name ?? "Evidence")).join(", ")
  return String(value)
}

function AuditTab({ record, language }: { record: InspectionRecord; language: Language }) {
  const t = words[language]
  const events = [
    { id: "created", at: record.createdAt, text: t.timelineCreated, actor: personName(record.inspectorId) },
    ...(record.submittedAt ? [{ id: "submitted", at: record.submittedAt, text: t.timelineSubmitted, actor: personName(record.inspectorId) }] : []),
    ...record.reviewHistory.map((entry) => ({ id: entry.id, at: entry.at, text: `${entry.decision === "approved" ? t.timelineApproved : t.timelineReturned} · ${stageLabel(language, entry.stage)}`, actor: personName(entry.actorId) !== "—" ? personName(entry.actorId) : demoActorLabel(entry.actorId) })),
  ].sort((a, b) => a.at.localeCompare(b.at))
  return <><h2>{t.audit}</h2><p className="ux-muted">{t.auditHint}</p><ol className="inspection-history">{events.map((event) => <li key={event.id}><strong>{event.text}</strong><span>{event.actor}</span><time dateTime={event.at}>{formatDateTime(event.at, language)}</time></li>)}<li><strong>Revision {record.revision}</strong><span>{t.updated}</span><time dateTime={record.updatedAt}>{formatDateTime(record.updatedAt, language)}</time></li></ol></>
}

/* ----------------------------------------------------------------- review */

function ReviewPanel({ record, language, role, onChange }: { record: InspectionRecord; language: Language; role: string; onChange: (record: InspectionRecord) => void }) {
  const t = words[language]
  const [returning, setReturning] = useState(false)
  const [reason, setReason] = useState("")
  const [message, setMessage] = useState("")
  const [conflict, setConflict] = useState(false)
  const actor = demoActor(role)
  const stage = record.currentStage
  const waiting = ["submitted", "in_review"].includes(record.status) && stage
  if (!waiting) return null
  const mayAct = reviewStagesFor(role).includes(stage)
  if (!mayAct) return <p className="ux-waiting" role="status"><Clock3 size={15} aria-hidden="true" />{t.waitingFor} {stageLabel(language, stage)}</p>
  if (actor.userId === record.inspectorId) return <p className="ux-waiting" role="status"><ShieldCheck size={15} aria-hidden="true" />{t.separation}</p>

  const act = (decision: "approved" | "returned") => {
    try {
      onChange(inspectionRepository.review(record.id, { decision, actorId: actor.userId, reason, expectedRevision: record.revision, stage }))
      setMessage(""); setReturning(false); setReason(""); setConflict(false)
    } catch (error) {
      if ((error as { code?: string }).code === "STALE_REVISION") setConflict(true)
      setMessage(errorMessage(language, error))
    }
  }
  return <div className="inspection-review-actions">
    <p className="ux-review-heading">{t.waitingFor} <strong>{stageLabel(language, stage)}</strong></p>
    <div className="ux-review-buttons">
      <button type="button" className="button-outline" onClick={() => { setReturning(true); setMessage("") }}>{t.return}</button>
      <button type="button" className="button-primary" onClick={() => act("approved")}><Check size={15} aria-hidden="true" />{t.approveAs} {stageLabel(language, stage)}</button>
    </div>
    {message && <p role="alert" className="inspection-alert">{message}{conflict && <> <button type="button" className="ux-link" onClick={() => { const latest = inspectionRepository.get(record.id); if (latest) { onChange(latest); setMessage(""); setConflict(false) } }}>{t.reload}</button></>}</p>}
    {returning && <Dialog title={t.returnDialog} closeLabel={t.cancel} onClose={() => setReturning(false)}>
      <label>{t.reasonLabel}<textarea data-autofocus value={reason} onChange={(event) => setReason(event.target.value)} rows={4} aria-describedby="return-hint" /></label>
      <p id="return-hint" className="ux-dialog-hint">{t.reasonHint}</p>
      {message && <p role="alert" className="inspection-alert">{message}</p>}
      <div className="inspection-modal-actions"><button type="button" className="button-outline" onClick={() => setReturning(false)}>{t.cancel}</button><button type="button" className="button-primary" onClick={() => act("returned")}>{t.confirmReturn}</button></div>
    </Dialog>}
  </div>
}

/* --------------------------------------------------------------- findings */

function FindingsTab({ record, actions, language, role, canCreate, onCreated }: { record: InspectionRecord; actions: ActionRecord[]; language: Language; role: string; canCreate: boolean; onCreated: () => void }) {
  const t = words[language]
  const [creatingFor, setCreatingFor] = useState<InspectionFinding | null>(null)
  const findings = record.findings ?? []
  return <>
    <h2>{t.findings}</h2>
    {findings.length === 0 && <p className="ux-muted">{t.emptyHint}</p>}
    {findings.map((finding) => { const linked = actions.filter((action) => action.findingId === finding.id)
      return <article className="inspection-finding ux-finding" key={finding.id}>
        <div className="ux-finding-head"><div><strong>{finding.title}</strong>{finding.description && <span>{finding.description}</span>}</div><PriorityBadge priority={finding.priority} label={priorityText(finding.priority, language)} /></div>
        <div className="ux-finding-actions"><span className="ux-muted">{t.actionsLinked}: {plural(language, "action", linked.length)}</span>
          {linked.map((action) => <Link key={action.id} className="ux-link" href={`/app/actions/${action.id}`}>{action.id}</Link>)}
          {canCreate && <button type="button" className="button-outline ux-small" onClick={() => setCreatingFor(finding)}><Plus size={14} aria-hidden="true" />{t.createAction}</button>}</div>
      </article> })}
    {creatingFor && <CreateActionDialog record={record} finding={creatingFor} language={language} role={role} onClose={() => setCreatingFor(null)} onCreated={() => { setCreatingFor(null); onCreated() }} />}
  </>
}

function CreateActionDialog({ record, finding, language, role, onClose, onCreated }: { record: InspectionRecord; finding: InspectionFinding; language: Language; role: string; onClose: () => void; onCreated: () => void }) {
  const t = words[language]
  const owners = people.filter((person) => person.workspaceId === record.workspaceId && person.siteIds.includes(record.siteId))
  const [title, setTitle] = useState(finding.title)
  const [ownerId, setOwnerId] = useState(owners.find((person) => person.role === "action_owner")?.id ?? owners[0]?.id ?? "")
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">(finding.priority)
  const [dueAt, setDueAt] = useState("")
  const [error, setError] = useState("")
  const create = () => {
    try {
      actionRepository.create({ workspaceId: record.workspaceId, siteId: record.siteId, findingId: finding.id, inspectionId: record.id, title, description: finding.description, ownerId, priority, closureDueAt: dueAt ? new Date(`${dueAt}T17:00:00`).toISOString() : undefined, createdBy: demoActor(role).userId })
      onCreated()
    } catch (caught) { setError(errorMessage(language, caught)) }
  }
  return <Dialog title={t.createAction} closeLabel={t.cancel} onClose={onClose}>
    <label>{t.actionTitle}<input data-autofocus value={title} onChange={(event) => setTitle(event.target.value)} /></label>
    <label>{t.owner}<select value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>{owners.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>
    <label>{t.priority}<select value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}>{(["low", "medium", "high", "critical"] as const).map((item) => <option key={item} value={item}>{priorityText(item, language)}</option>)}</select></label>
    <label>{t.closureDue}<input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>
    {error && <p role="alert" className="inspection-alert">{error}</p>}
    <div className="inspection-modal-actions"><button type="button" className="button-outline" onClick={onClose}>{t.cancel}</button><button type="button" className="button-primary" disabled={!title.trim() || !ownerId} onClick={create}>{t.createAction}</button></div>
  </Dialog>
}
