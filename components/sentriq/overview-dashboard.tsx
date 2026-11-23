"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Activity, ArrowRight, Check, ClipboardCheck, Clock3, FileText, Flag, RefreshCw, Search, X } from "lucide-react"
import type { Language } from "./app-shell"
import { Dialog } from "./dialog"
import type { DashboardData } from "@/lib/sentriq/dashboard-service"
import { actionRepository } from "@/lib/actions/repository"
import { inspectionRepository } from "@/lib/inspections/repository"
import { buildOverview, filterWork, overdueAt, type OverviewSource, type OverviewView, type WorkItem } from "@/lib/sentriq/overview-model"
import { demoActor, hasCompanyAccess } from "@/lib/sentriq/demo-permissions"

const words = {
  en: { title: "Operational overview", demo: "Demo workspace · local browser data, not production records", brief: "OPERATIONAL BRIEF", decisions: "Awaiting your decision", late: "Overdue in this view", count: "Assignments & follow-ups", headline: "A clear view. A decisive next step.", hint: "Review submissions, follow up on overdue work, and keep your next step in focus.", recommended: "NEXT REVIEW", noReview: "No decisions waiting for you", noReviewHint: "New review requests will appear here when your demo role can act on them.", review: "Start review", open: "Open record", work: "Work that needs you", scope: "Your assignments and review decisions", team: "Open work across the workspace", mine: "My work", workspace: "Workspace", reviews: "My reviews", overdue: "Overdue", allSites: "All sites", record: "Record / site", status: "Status", due: "Due", next: "Next step", follow: "Follow up", resume: "Continue", verify: "Verify", view: "View record", noWork: "You are all caught up", noWorkHint: "There is no assigned work in this view. Nothing from the workspace is being shown as your personal work.", noMatch: "No matching work", noMatchHint: "Try another site, view or search term.", reset: "Clear filters", attention: "Where attention is needed", siteHint: "Open corrective actions by site. The accent marks overdue work.", onTime: "Not overdue", actions: "open", activity: "What changed", noActivity: "No activity recorded.", noSites: "No sites in this view.", more: "Show more", saved: "Save view", savedViews: "Saved views", savedNote: "View saved in this browser", saveError: "Could not save this view in the browser.", remove: "Remove saved view", dataError: "Saved demo data could not be read. No data was overwritten.", retry: "Retry", loading: "Loading saved demo work…", preview: "Record preview", close: "Close", site: "Site", owner: "Owner", noOwner: "Unassigned", latest: "Latest recorded events", noAccess: "This role has no company workspace access", roleHint: "Choose a company demo role to view operational records.", search: "Search work by name or ID", filters: "Work views", emptyDate: "No deadline", inspect: "Inspections", shown: "records shown", readOnly: "Demo role simulation is not authorization." },
  ar: { title: "نظرة تشغيلية", demo: "مساحة تجريبية · بيانات محلية بالمتصفح وليست سجلات إنتاجية", brief: "ملخص العمل", decisions: "بانتظار قرارك", late: "متأخر في هذا العرض", count: "مهام ومتابعات", headline: "رؤية أوضح. وخطوة تالية محددة.", hint: "راجع الطلبات، وتابع العمل المتأخر، واعرف خطوتك التالية بوضوح.", recommended: "المراجعة التالية", noReview: "لا توجد قرارات بانتظارك", noReviewHint: "ستظهر طلبات المراجعة عندما يسمح دورك التجريبي بالتصرف فيها.", review: "بدء المراجعة", open: "فتح السجل", work: "ما يحتاج تدخلك", scope: "تكليفاتك والقرارات المسندة إلى دورك", team: "الأعمال المفتوحة عبر مساحة العمل", mine: "عملي", workspace: "مساحة العمل", reviews: "مراجعاتي", overdue: "متأخر", allSites: "كل المواقع", record: "السجل / الموقع", status: "الحالة", due: "الاستحقاق", next: "الخطوة التالية", follow: "متابعة", resume: "استكمال", verify: "التحقق", view: "عرض السجل", noWork: "لا توجد مهام في هذا العرض", noWorkHint: "لا يوجد عمل مسند إليك هنا. لن نعرض أعمال الشركة باعتبارها عملك الشخصي.", noMatch: "لا توجد أعمال مطابقة", noMatchHint: "جرّب موقعًا أو عرضًا آخر أو غيّر كلمات البحث.", reset: "مسح الفلاتر", attention: "أين تحتاج المتابعة", siteHint: "الإجراءات التصحيحية المفتوحة حسب الموقع. الجزء الملون يوضح المتأخر.", onTime: "غير متأخر", actions: "مفتوحة", activity: "آخر المستجدات", noActivity: "لا توجد أحداث مسجلة.", noSites: "لا توجد مواقع في هذا العرض.", more: "عرض المزيد", saved: "حفظ العرض", savedViews: "العروض المحفوظة", savedNote: "تم حفظ العرض في هذا المتصفح", saveError: "تعذر حفظ العرض في المتصفح.", remove: "حذف العرض المحفوظ", dataError: "تعذرت قراءة البيانات التجريبية المحفوظة. لم يتم استبدال أي بيانات.", retry: "إعادة المحاولة", loading: "جارٍ تحميل الأعمال المحفوظة…", preview: "معاينة السجل", close: "إغلاق", site: "الموقع", owner: "المسؤول", noOwner: "غير مسند", latest: "آخر الأحداث المسجلة", noAccess: "هذا الدور لا يملك وصولًا لمساحة الشركة", roleHint: "اختر دورًا تجريبيًا بالشركة لعرض السجلات التشغيلية.", search: "البحث في العمل بالاسم أو الرقم", filters: "عروض العمل", emptyDate: "دون موعد", inspect: "التفتيشات", shown: "سجلات معروضة", readOnly: "محاكاة الدور التجريبي لا تمثل صلاحيات حقيقية." },
}
const statuses: Record<string, [string, string]> = { draft: ["Draft", "مسودة"], returned: ["Returned", "مُعاد"], submitted: ["Submitted", "مُقدم"], in_review: ["In review", "قيد المراجعة"], open: ["Open", "مفتوح"], in_progress: ["In progress", "قيد التنفيذ"], closure_requested: ["Closure review", "مراجعة الإغلاق"], scheduled: ["Scheduled", "مجدول"] }
type SavedView = { view: OverviewView; siteId: string; query: string }
const savedKey = (workspace: string, role: string) => `sentriq.overview.views.v1:${workspace}:${role}`

export function OverviewDashboard({ data, language, search, role = "company_superadmin", workspaceId }: { data: DashboardData; language: Language; search: string; role?: string; workspaceId?: string }) {
  const t = words[language], rtl = language === "ar", id = workspaceId ?? data.workspace.id
  const [live, setLive] = useState<Pick<OverviewSource, "inspections" | "actions"> | null>(null)
  const [ready, setReady] = useState(false), [error, setError] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [view, setView] = useState<OverviewView>("mine"), [siteId, setSiteId] = useState("")
  const [query, setQuery] = useState(""), [limit, setLimit] = useState(6)
  const [selected, setSelected] = useState<WorkItem | null>(null)
  const [saved, setSaved] = useState<SavedView[]>([]), [notice, setNotice] = useState("")
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const read = () => {
      try { setLive({ inspections: inspectionRepository.list(id), actions: actionRepository.list(id) }); setError(false) } catch { setLive(null); setError(true) }
      setReady(true); setNow(new Date())
    }
    setReady(false); read()
    window.addEventListener("focus", read); window.addEventListener("storage", read)
    const tick = window.setInterval(() => setNow(new Date()), 60000)
    return () => { window.removeEventListener("focus", read); window.removeEventListener("storage", read); window.clearInterval(tick) }
  }, [id, retry])
  useEffect(() => {
    setView("mine"); setSiteId(""); setQuery(""); setSelected(null); setNotice("")
    try { const value: unknown = JSON.parse(localStorage.getItem(savedKey(id, role)) ?? "[]"); setSaved(Array.isArray(value) ? value.filter((v): v is SavedView => !!v && ["mine", "workspace", "reviews", "overdue"].includes(v.view) && typeof v.siteId === "string" && typeof v.query === "string").slice(0, 5) : []) } catch { setSaved([]) }
  }, [id, role])
  useEffect(() => { setLimit(6) }, [view, siteId, query, search])
  const model = useMemo(() => buildOverview({ ...data, ...(live ?? {}) }, role, now), [data, live, role, now])
  const effectiveView = view === "workspace" && !model.manager ? "mine" : view
  const base = effectiveView === "workspace" ? model.items : model.personal
  const term = [search, query].filter(Boolean).join(" ")
  const all = filterWork(base, "mine", siteId, "", now)
  const visible = filterWork(base, effectiveView, siteId, term, now)
  const personal = filterWork(model.personal, "mine", siteId, "", now)
  const recommendation = personal.find((r) => r.review)
  const sites = model.siteStats.filter((r) => !siteId || r.id === siteId)
  const max = Math.max(1, ...sites.map((r) => r.open))
  const activity = data.auditEvents.slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3)
  const date = (value?: string) => {
    if (!value) return t.emptyDate
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value)
    return Number.isNaN(parsed.getTime()) ? t.emptyDate : new Intl.DateTimeFormat(rtl ? "ar-EG" : "en-GB", { day: "numeric", month: "short" }).format(parsed)
  }
  const status = (r: WorkItem) => overdueAt(r.dueAt, now) ? t.overdue : (statuses[r.status]?.[rtl ? 1 : 0] ?? r.status.replaceAll("_", " "))
  const next = (r: WorkItem) => r.review ? r.kind === "action" ? t.verify : t.review : overdueAt(r.dueAt, now) ? t.follow : ["draft", "returned"].includes(r.status) ? t.resume : t.view
  const clear = () => { setQuery(""); setSiteId(""); setView("mine") }
  const persist = (nextSaved: SavedView[]) => {
    try { localStorage.setItem(savedKey(id, role), JSON.stringify(nextSaved)); setSaved(nextSaved); setNotice(t.savedNote) } catch { setNotice(t.saveError) }
  }
  if (!hasCompanyAccess(role)) return <section className="sq-overview" dir={rtl ? "rtl" : "ltr"}><div className="sq-empty"><Check /><h1>{t.noAccess}</h1><p>{t.roleHint}</p></div></section>
  return <div className="sq-overview" dir={rtl ? "rtl" : "ltr"}>
    <div className="sq-demo"><i />{t.demo}</div>
    <header className="sq-heading"><div><h1>{t.title}</h1><p>{data.workspace.name} · {data.workspace.industryLabel}</p></div><div className="sq-heading-actions"><label className="sq-site-select"><span className="sr-only">{t.site}</span><select value={siteId} onChange={(e) => setSiteId(e.target.value)}><option value="">{t.allSites}</option>{data.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><Link className="sq-button sq-button-primary" href="/app/inspections"><ClipboardCheck size={15} />{t.inspect}</Link></div></header>
    {error && <div className="sq-error" role="alert"><span>{t.dataError}</span><button onClick={() => setRetry((v) => v + 1)}><RefreshCw size={14} />{t.retry}</button></div>}
    {!ready ? <div className="sq-loading" role="status"><span className="sq-skeleton" />{t.loading}</div> : !error && <>
      <section className="sq-hero-grid"><article className="sq-brief"><div className="sq-brief-content"><div className="sq-eyebrow"><i />{t.brief} / {date(now.toISOString())}</div><h2>{t.headline}</h2><p>{t.hint}</p></div><div className="sq-stats"><button onClick={() => setView("reviews")}><strong>{personal.filter((r) => r.review).length}</strong><span>{t.decisions}</span></button><button onClick={() => setView("overdue")}><strong className="sq-warm">{all.filter((r) => overdueAt(r.dueAt, now)).length}</strong><span>{t.late}</span></button><button onClick={() => setView(effectiveView === "workspace" ? "workspace" : "mine")}><strong>{all.length}</strong><span>{t.count}</span></button></div></article>
      <article className="sq-card sq-next"><div className="sq-eyebrow"><Clock3 size={14} />{t.recommended}</div>{recommendation ? <><h2>{recommendation.title}</h2><p>{data.sites.find((s) => s.id === recommendation.siteId)?.name}</p><small><bdi>{recommendation.id}</bdi> · {date(recommendation.dueAt)}</small><div className="sq-next-bottom"><span className={`sq-badge sq-badge-${recommendation.status}`}>{status(recommendation)}</span><Link className="sq-button sq-button-primary" href={recommendation.href}>{t.review}<ArrowRight size={14} /></Link></div></> : <div className="sq-next-empty"><Check size={25} /><h2>{t.noReview}</h2><p>{t.noReviewHint}</p></div>}</article></section>
      <div className="sq-main-grid"><section className="sq-card sq-queue"><header className="sq-section-heading"><div><h2>{t.work}</h2><p>{effectiveView === "workspace" ? t.team : t.scope}</p></div><span className="sq-actor">{demoActor(role).label}</span></header>
        <div className="sq-toolbar"><div className="sq-view-tabs" role="group" aria-label={t.filters}>{(["mine", ...(model.manager ? ["workspace"] : []), "reviews", "overdue"] as OverviewView[]).map((v) => <button key={v} aria-pressed={effectiveView === v} className={effectiveView === v ? "is-selected" : ""} onClick={() => setView(v)}>{v === "mine" ? t.mine : v === "workspace" ? t.workspace : v === "reviews" ? t.reviews : t.overdue}</button>)}</div><button className="sq-save" onClick={() => { const item = { view: effectiveView, siteId, query }; persist([item, ...saved.filter((s) => JSON.stringify(s) !== JSON.stringify(item))].slice(0, 5)) }}>＋ {t.saved}</button></div>
        <label className="sq-work-search"><Search size={14} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search} aria-label={t.search} /></label>
        {!!saved.length && <div className="sq-saved" aria-label={t.savedViews}>{saved.map((s, i) => <span key={i}><button onClick={() => { setView(s.view); setSiteId(s.siteId); setQuery(s.query) }}>{s.view === "mine" ? t.mine : s.view === "workspace" ? t.workspace : s.view === "reviews" ? t.reviews : t.overdue} · {data.sites.find((r) => r.id === s.siteId)?.name ?? t.allSites}{s.query ? ` · ${s.query}` : ""}</button><button aria-label={`${t.remove} ${i + 1}`} onClick={() => persist(saved.filter((_, n) => n !== i))}><X size={12} /></button></span>)}</div>}
        <div role="status" className="sq-notice">{notice}</div>
        {visible.length ? <><div className="sq-columns" aria-hidden="true"><span>{t.record}</span><span>{t.status}</span><span>{t.due}</span><span>{t.next}</span></div><ul className="sq-work-list">{visible.slice(0, limit).map((r) => <li key={`${r.kind}:${r.id}`}><button className="sq-row-preview" onClick={() => setSelected(r)}><span className="sq-record-icon">{r.kind === "inspection" ? <ClipboardCheck size={17} /> : r.kind === "action" ? <Flag size={17} /> : <Clock3 size={17} />}</span><span><strong>{r.title}</strong><small><bdi>{r.id}</bdi> · {data.sites.find((s) => s.id === r.siteId)?.name}</small></span></button><span className={`sq-badge sq-badge-${overdueAt(r.dueAt, now) ? "overdue" : r.status}`}>{status(r)}</span><span className={`sq-due${overdueAt(r.dueAt, now) ? " is-overdue" : ""}`}>{date(r.dueAt)}</span><Link className="sq-next-link" href={r.href}>{next(r)}<ArrowRight size={13} /></Link></li>)}</ul><div className="sq-queue-footer"><span>{Math.min(limit, visible.length)} / {visible.length} {t.shown}</span>{visible.length > limit ? <button onClick={() => setLimit((v) => v + 6)}>{t.more}</button> : <Link href="/app/my-work">{t.mine}<ArrowRight size={12} /></Link>}</div></> : <div className="sq-empty"><Check size={27} /><h3>{query || search || siteId || effectiveView !== "mine" ? t.noMatch : t.noWork}</h3><p>{query || search || siteId || effectiveView !== "mine" ? t.noMatchHint : t.noWorkHint}</p>{(query || siteId || effectiveView !== "mine") && <button className="sq-button" onClick={clear}>{t.reset}</button>}</div>}
      </section><div className="sq-rail"><section className="sq-card sq-sites"><h2>{t.attention}</h2><p>{t.siteHint}</p><div className="sq-legend"><span><i />{t.onTime}</span><span><i className="late" />{t.overdue}</span></div>{sites.map((site) => <div className="sq-site" key={site.id}><div><strong>{site.name}</strong><span>{site.open} {t.actions}</span></div><div className="sq-bar" role="img" aria-label={`${site.name}: ${site.open} ${t.actions}, ${site.overdue} ${t.overdue}`}><i style={{ width: `${(site.open - site.overdue) / max * 100}%` }} /><i className="late" style={{ width: `${site.overdue / max * 100}%` }} /></div><small>{site.overdue} {t.overdue}</small></div>)}{!sites.length && <p>{t.noSites}</p>}</section><section className="sq-card sq-activity"><h2>{t.activity}</h2><p className="sq-activity-note">{t.latest}</p>{activity.length ? <ol>{activity.map((event) => <li key={event.id}><i /><div><p><strong>{data.users.find((u) => u.id === event.actorId)?.displayName ?? t.owner}</strong> {event.summary}</p><small><bdi>{event.recordId}</bdi> · {date(event.at)}</small></div></li>)}</ol> : <p>{t.noActivity}</p>}</section></div></div>
    </>}
    <footer className="sq-footer"><span>SENTRIQ · {data.workspace.name}</span><span>{t.readOnly}</span></footer>
    {selected && <Dialog title={t.preview} closeLabel={t.close} onClose={() => setSelected(null)}><div className="sq-preview"><span className={`sq-badge sq-badge-${overdueAt(selected.dueAt, now) ? "overdue" : selected.status}`}>{status(selected)}</span><h2>{selected.title}</h2><p><bdi>{selected.id}</bdi></p><dl><div><dt>{t.site}</dt><dd>{data.sites.find((s) => s.id === selected.siteId)?.name ?? "—"}</dd></div><div><dt>{t.owner}</dt><dd>{data.users.find((u) => u.id === selected.ownerId)?.displayName ?? t.noOwner}</dd></div><div><dt>{t.due}</dt><dd>{date(selected.dueAt)}</dd></div></dl><Link className="sq-button sq-button-primary" href={selected.href}>{t.open}<ArrowRight size={15} /></Link></div></Dialog>}
  </div>
}
