"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, CloudOff, MapPin, ArrowLeft, Check, CheckCircle2, ChevronLeft, ChevronRight, Flag, Upload, WifiOff } from "lucide-react"
import { evaluateFormula, getQuestionRuntimeStates, roundCalculated, RUNNER_FIELD_TYPES, validateAnswer, type Question } from "@/lib/forms/domain"
import { inspectionRepository, type InspectionAnswer, type InspectionFinding, type InspectionRecord } from "@/lib/inspections/repository"
import { discardQueued, enqueueSubmission, flushOutbox, outboxEntry, reviseQueued } from "@/lib/inspections/outbox"
import { effectiveAnswers } from "@/lib/inspections/hidden"
import { GPS_MANUAL_ENTRY_NEEDS_FORM_FLAG, HIDDEN_ANSWER_RULE } from "@/lib/inspections/policy"
import { differingAnswers, SyncConflict, type ConflictItem } from "@/components/sentriq/sync-conflict"
import { errorMessage, formatNumber, plural, type Language } from "@/lib/sentriq/format"
import { words } from "@/lib/sentriq/inspections-i18n"
import { SignaturePad } from "@/components/sentriq/signature-pad"
import { Dialog } from "@/components/sentriq/dialog"
import { answersToRows, isAnswered, questionLabel, type Template } from "@/components/sentriq/inspection-shared"

type SaveState = "clean" | "dirty" | "saving" | "saved"
type SyncState = "draft" | "queued" | "syncing" | "submitted" | "conflict" | "blocked"
type Props = { record: InspectionRecord; template?: Template; language: Language; onChange: (record: InspectionRecord) => void; onExit: () => void }

export function InspectionRunner({ record: initial, template, language, onChange, onExit }: Props) {
  const rtl = language === "ar"
  const t = words[language]
  const form = template?.snapshot
  const [record, setRecord] = useState(initial)
  const [sectionIndex, setSectionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => Object.fromEntries(initial.answers.map((item) => [item.questionId, item.value])))
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [attempted, setAttempted] = useState(false)
  const [evidenceUrls, setEvidenceUrls] = useState<Record<string, string[]>>({})
  const [findings, setFindings] = useState<InspectionFinding[]>(initial.findings ?? [])
  const [flagging, setFlagging] = useState<Question | null>(null)
  const [draftFinding, setDraftFinding] = useState({ title: "", description: "", priority: "medium" as InspectionFinding["priority"], photo: "" })
  const [showReview, setShowReview] = useState(false)
  const [syncState, setSyncState] = useState<SyncState>(() => { if (initial.status === "submitted") return "submitted"; const entry = outboxEntry(initial.id); return entry ? (entry.state === "conflict" ? "conflict" : entry.state === "blocked" ? "blocked" : "queued") : "draft" })
  const [conflictItems, setConflictItems] = useState<ConflictItem[] | null>(null)
  const [serverRows, setServerRows] = useState<InspectionAnswer[]>([])
  const [locationNote, setLocationNote] = useState("")
  const done = syncState !== "draft"
  const [conflict, setConflict] = useState(false)
  const [message, setMessage] = useState("")
  const [saveState, setSaveState] = useState<SaveState>("clean")
  const [savedTime, setSavedTime] = useState("")
  const [online, setOnline] = useState(true)
  const [signedAt, setSignedAt] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const sending = useRef(false)
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setRecord(initial) }, [initial])
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener("online", update); window.addEventListener("offline", update)
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update) }
  }, [])

  const sections = form?.sections ?? []
  const currentSection = sections[sectionIndex]
  // Calculated questions are filled from the other answers. Keep them out of the typed state so they always match.
  const values = useMemo(() => {
    if (!form) return answers
    const next = { ...answers }
    for (const question of form.questions) {
      if (question.type !== "calculated") continue
      try { next[question.id] = roundCalculated(evaluateFormula(String(question.config.formula ?? ""), next, form.questions), Number(question.config.precision ?? 2), (question.config.rounding as "half_up" | "half_even" | "truncate" | undefined) ?? "half_up") } catch { delete next[question.id] }
    }
    return next
  }, [form, answers])
  const runtime = useMemo(() => (form ? getQuestionRuntimeStates(form, effectiveAnswers(form, values)) : {}), [form, values])
  const shown = (question: Question) => Boolean(runtime[question.id]?.visible)
  const answerable = (question: Question) => question.type !== "instruction" && shown(question)
  const questionsOf = (sectionId: string) => (sections.find((section) => section.id === sectionId)?.questionIds ?? []).map((id) => form?.questions.find((item) => item.id === id)).filter((question): question is Question => Boolean(question && answerable(question)))
  const errorOf = (question: Question) => !RUNNER_FIELD_TYPES.includes(question.type) ? undefined : validateAnswer({ ...question, required: runtime[question.id]?.required ?? question.required }, values[question.id])
  const visibleQuestions = currentSection ? (currentSection.questionIds.map((id) => form?.questions.find((item) => item.id === id)).filter((question): question is Question => Boolean(question && shown(question)))) : []
  const allQuestions = sections.flatMap((section) => questionsOf(section.id))
  const errors = allQuestions.map((question) => ({ question, message: errorOf(question) })).filter((item) => item.message)
  const answeredCount = allQuestions.filter((question) => isAnswered(values[question.id])).length
  const totalCount = allQuestions.length
  const progress = totalCount ? Math.round((answeredCount / totalCount) * 100) : 0
  const sectionMissing = (sectionId: string) => questionsOf(sectionId).filter((question) => errorOf(question)).length

  const mark = (id: string) => setTouched((current) => new Set(current).add(id))
  const setAnswer = (question: Question, value: unknown) => { setAnswers((current) => ({ ...current, [question.id]: value })); mark(question.id); setSaveState("dirty") }

  // Hidden questions: kept on the device while drafting, never sent and never scored (HIDDEN_ANSWER_RULE).
  const rowsFor = (forSubmission: boolean) => {
    if (!form || !forSubmission && HIDDEN_ANSWER_RULE === "keep_on_device_exclude_from_submission") return answersToRows(values)
    return answersToRows(effectiveAnswers(form, values))
  }

  const persist = () => {
    setSaveState("saving")
    try {
      const next = inspectionRepository.saveDraft(record.id, rowsFor(false), record.revision, findings)
      setRecord(next); onChange(next); setConflict(false); setMessage("")
      setSavedTime(new Intl.DateTimeFormat(language === "ar" ? "ar" : "en", { hour: "2-digit", minute: "2-digit" }).format(new Date()))
      setSaveState("saved")
      return next
    } catch (error) {
      setSaveState("dirty")
      if ((error as { code?: string }).code === "STALE_REVISION") setConflict(true)
      else setMessage(errorMessage(language, error))
      return undefined
    }
  }

  const runFlush = (current: InspectionRecord) => {
    setSyncState("syncing")
    window.setTimeout(() => {
      const result = flushOutbox(inspectionRepository, navigator.onLine, undefined, current.id)[0]
      if (!result || result.outcome === "offline") setSyncState("queued")
      else if (result.outcome === "submitted") { if (result.record) { setRecord(result.record); onChange(result.record) } setSyncState("submitted") }
      else setSyncState(result.outcome === "conflict" ? "conflict" : "blocked")
    }, 0)
  }
  const flushRef = useRef(runFlush); flushRef.current = runFlush
  const persistRef = useRef(persist); persistRef.current = persist
  const dirtyRef = useRef(false); dirtyRef.current = saveState === "dirty" && !done

  useEffect(() => {
    const onOnline = () => { if (syncState === "queued") flushRef.current(record) }
    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
  }, [syncState, record])
  useEffect(() => { if (syncState === "queued" && navigator.onLine) flushRef.current(record) }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  // A draft must survive leaving the page, a call, or closing the app.
  useEffect(() => {
    const save = () => { if (dirtyRef.current) persistRef.current() }
    const hidden = () => { if (document.visibilityState === "hidden") save() }
    window.addEventListener("pagehide", save); document.addEventListener("visibilitychange", hidden)
    return () => { window.removeEventListener("pagehide", save); document.removeEventListener("visibilitychange", hidden); save() }
  }, [])

  useEffect(() => {
    if (done || saveState !== "dirty") return
    const timer = window.setTimeout(() => persist(), 10000)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, findings, saveState, done])

  const updateEvidence = (question: Question, files: File[]) => {
    setEvidenceUrls((current) => { current[question.id]?.forEach((url) => URL.revokeObjectURL(url)); return { ...current, [question.id]: files.map((file) => URL.createObjectURL(file)) } })
    setAnswer(question, files)
  }
  useEffect(() => () => Object.values(evidenceUrls).flat().forEach((url) => URL.revokeObjectURL(url)), [evidenceUrls])

  const goToSection = (index: number) => { setShowReview(false); setSectionIndex(index); topRef.current?.scrollIntoView({ block: "start" }) }
  const goNext = () => { setAttempted(true); persist(); if (sectionIndex < sections.length - 1) goToSection(sectionIndex + 1); else { setShowReview(true); topRef.current?.scrollIntoView({ block: "start" }) } }
  const jumpTo = (question: Question) => { setAttempted(true); goToSection(Math.max(0, sectionOfQuestion(question.id))); window.setTimeout(() => { const target = document.getElementById(`question-${question.id}`); target?.scrollIntoView({ block: "center" }); target?.querySelector<HTMLElement>("input,textarea,button")?.focus({ preventScroll: true }) }, 60) }
  const submitNow = () => {
    if (sending.current) return
    if (errors.length) { jumpTo(errors[0].question); return }
    sending.current = true; setSubmitting(true)
    const saved = persist()
    if (!saved) { sending.current = false; setSubmitting(false); return }
    // Write to the device queue first, then send. Same client id on every retry.
    enqueueSubmission({ inspectionId: saved.id, expectedRevision: saved.revision, answers: rowsFor(true), findings })
    sending.current = false; setSubmitting(false)
    runFlush(saved)
  }
  const sectionOfQuestion = (questionId: string) => sections.findIndex((section) => section.questionIds.includes(questionId))

  const addFinding = () => {
    if (!flagging || !draftFinding.title.trim()) return
    setFindings((current) => [...current, { id: `FND-${Date.now()}`, questionId: flagging.id, title: draftFinding.title.trim(), description: draftFinding.description.trim(), priority: draftFinding.priority, photoName: draftFinding.photo || undefined }])
    setSaveState("dirty"); setFlagging(null); setDraftFinding({ title: "", description: "", priority: "medium", photo: "" })
  }

  const [locating, setLocating] = useState("")
  const manualAllowed = (question: Question) => !GPS_MANUAL_ENTRY_NEEDS_FORM_FLAG || question.config.manualEntry === true
  const locate = (question: Question) => {
    const typeHint = manualAllowed(question) ? t.typeInstead : ""
    setLocationNote("")
    if (typeof navigator === "undefined" || !navigator.geolocation) { setLocationNote(t.locationOff + typeHint); return }
    setLocating(question.id)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        try {
          const digits = Math.min(8, Math.max(0, Math.trunc(Number(question.config.precision ?? 6)) || 0))
          setAnswer(question, `${position.coords.latitude.toFixed(digits)}, ${position.coords.longitude.toFixed(digits)}`)
        } catch { setLocationNote(t.locationOff + typeHint) }
        setLocating("")
      },
      (error) => { setLocating(""); setLocationNote((error.code === 1 ? t.locationBlocked : error.code === 3 ? t.locationTimeout : t.locationOff) + typeHint) },
      { enableHighAccuracy: true, timeout: 15000 })
  }

  const field = (question: Question) => {
    const value = answers[question.id] ?? ""
    const name = questionLabel(question, language)
    const id = `input-${question.id}`
    if (!RUNNER_FIELD_TYPES.includes(question.type)) return <p className="runner-unsupported" role="note">{t.notSupported}</p>
    if (question.type === "boolean") return <div className="runner-choice-row" role="group" aria-label={name}>{[true, false].map((option) => <button type="button" key={String(option)} className={answers[question.id] === option ? "selected" : ""} aria-pressed={answers[question.id] === option} onClick={() => setAnswer(question, option)}>{answers[question.id] === option && <Check size={16} aria-hidden="true" />}{option ? t.yes : t.no}</button>)}</div>
    if (question.type === "single_select" || question.type === "multi_select") return <div className="runner-options" role={question.type === "single_select" ? "radiogroup" : "group"} aria-label={name}>{(question.config.choices ?? []).map((choice) => {
      const selected = question.type === "multi_select" ? Array.isArray(value) && value.includes(choice.id) : value === choice.id
      return <label className={`runner-option${selected ? " selected" : ""}`} key={choice.id}><input type={question.type === "multi_select" ? "checkbox" : "radio"} name={question.id} checked={selected} onChange={() => setAnswer(question, question.type === "multi_select" ? (selected ? (value as string[]).filter((item) => item !== choice.id) : [...(Array.isArray(value) ? value : []), choice.id]) : choice.id)} /><span>{choice.label[language] || choice.label.en}</span></label>
    })}</div>
    if (question.type === "photo" || question.type === "file") return <div className="runner-evidence"><label className="runner-file" htmlFor={id}><Upload size={20} aria-hidden="true" /><span>{question.type === "photo" ? t.addPhoto : t.addFile}</span><input id={id} aria-label={name} type="file" accept={question.type === "photo" ? "image/*" : "*/*"} capture={question.type === "photo" ? "environment" : undefined} multiple={Number(question.config.maxFiles ?? 1) > 1} onChange={(event) => updateEvidence(question, Array.from(event.target.files ?? []))} /></label>
      {Array.isArray(value) && value.length > 0 && <div className="runner-evidence-list">{value.map((file, index) => { const fileName = typeof file === "string" ? file : (file as File).name; return <div className="runner-evidence-item" key={`${fileName}-${index}`}>{question.type === "photo" && evidenceUrls[question.id]?.[index] && <img src={evidenceUrls[question.id][index]} alt={language === "ar" ? `معاينة ${index + 1}` : `Evidence ${index + 1} preview`} />}<span>{fileName}</span><button type="button" aria-label={`${t.remove} ${fileName}`} onClick={() => updateEvidence(question, (value as File[]).filter((_, fileIndex) => fileIndex !== index))}>{t.remove}</button></div> })}</div>}</div>
    if (question.type === "calculated") return <p className="runner-calculated" id={id} role="status"><small>{t.calculatedLabel}</small><strong>{isAnswered(values[question.id]) ? formatNumber(Number(values[question.id]), language) : t.calculatedWait}</strong></p>
    if (question.type === "signature") return <SignaturePad value={typeof value === "string" ? value : ""} label={name} hint={t.signHere} clearLabel={t.clearSignature} signedLabel={t.signed} onChange={(data) => { setAnswer(question, data); setSignedAt((current) => { const next = { ...current }; if (data) next[question.id] = new Date().toISOString(); else delete next[question.id]; return next }) }} />
    if (question.type === "gps") return <div className="runner-gps"><button type="button" className="button-outline" onClick={() => locate(question)}><MapPin size={16} aria-hidden="true" />{locating === question.id ? t.locating : t.useLocation}</button><input id={id} aria-label={name} dir="ltr" inputMode="text" placeholder={t.coordsHint} readOnly={!manualAllowed(question)} value={String(value)} onChange={(event) => setAnswer(question, event.target.value)} />{locationNote && <small className="runner-error" role="alert">{locationNote}</small>}</div>
    if (question.type === "attestation") return <label className="runner-option"><input id={id} type="checkbox" checked={value === true} onChange={(event) => setAnswer(question, event.target.checked)} /><span>{(question.config.statement as { en?: string; ar?: string } | undefined)?.[language] ?? name}</span></label>
    if (question.type === "long_text") return <textarea id={id} aria-label={name} value={String(value)} onChange={(event) => setAnswer(question, event.target.value)} rows={4} />
    const type = question.type === "integer" || question.type === "decimal" ? "number" : question.type === "date" ? "date" : question.type === "time" ? "time" : question.type === "datetime" ? "datetime-local" : "text"
    return <input id={id} aria-label={name} type={type} inputMode={type === "number" ? "decimal" : undefined} value={String(value)} onChange={(event) => setAnswer(question, type === "number" ? (event.target.value === "" ? "" : Number(event.target.value)) : event.target.value)} />
  }

  const startResolve = () => {
    const latest = inspectionRepository.get(record.id); if (!latest) { setMessage(errorMessage(language, new Error("NOT_FOUND"))); return }
    const entry = outboxEntry(record.id)
    const mine = entry ? entry.answers : rowsFor(false)
    const diffs = differingAnswers(mine, latest.answers)
    setRecord(latest); onChange(latest); setServerRows(latest.answers)
    setAnswers(Object.fromEntries(mine.map((row) => [row.questionId, row.value])))
    if (entry) discardQueued(record.id)
    setSyncState("draft"); setConflict(false); setSaveState("dirty")
    if (diffs.length) setConflictItems(diffs.map((id) => { const question = form?.questions.find((item) => item.id === id); const pick = (rows: InspectionAnswer[]) => question ? formatReviewAnswer(question, rows.find((row) => row.questionId === id)?.value, language) : String(rows.find((row) => row.questionId === id)?.value ?? "—"); return { questionId: id, label: question ? questionLabel(question, language) : id, mine: pick(mine), server: pick(latest.answers) } }))
  }
  const resolveChoices = (choices: Record<string, "mine" | "server">) => {
    setAnswers((current) => { const next = { ...current }; for (const [id, side] of Object.entries(choices)) if (side === "server") { const row = serverRows.find((item) => item.questionId === id); if (row) next[id] = row.value; else delete next[id] } return next })
    setConflictItems(null); setSaveState("dirty")
  }
  const stateLabel: Record<SyncState, string> = { draft: t.stateDraft, queued: t.stateQueued, syncing: t.stateSyncing, submitted: t.stateSubmitted, conflict: t.conflictShort, blocked: t.blockedShort }

  if (conflictItems) return <section className="inspection-runner" dir={rtl ? "rtl" : "ltr"}><SyncConflict items={conflictItems} language={language} onResolve={resolveChoices} /></section>

  if (done) return <section className="inspection-runner ux-success" dir={rtl ? "rtl" : "ltr"} aria-live="polite">
    <span className="ux-success-mark">{syncState === "submitted" ? <CheckCircle2 size={34} aria-hidden="true" /> : <CloudOff size={34} aria-hidden="true" />}</span>
    <span className={`sync-badge is-${syncState}`} data-testid="sync-state">{stateLabel[syncState]}</span>
    <h1>{syncState === "submitted" ? t.submitted : syncState === "queued" ? t.queuedTitle : syncState === "syncing" ? t.submitting : syncState === "conflict" ? t.conflict : t.blockedMsg}</h1>
    {syncState === "submitted" && <p>{t.submittedHint}</p>}
    {syncState === "queued" && <p>{t.syncing}</p>}
    {syncState === "conflict" && <button type="button" className="button-primary" onClick={startResolve}>{t.reload}</button>}
    <dl className="ux-success-stats"><div><dt>{t.answered}</dt><dd>{formatNumber(answeredCount, language)}/{formatNumber(totalCount, language)}</dd></div><div><dt>{t.findingsTab}</dt><dd>{plural(language, "finding", findings.length)}</dd></div></dl>
    <div className="ux-success-actions">
      <Link className={syncState === "conflict" ? "button-outline" : "button-primary"} href="/app/inspections">{t.backWork}</Link>
      {syncState === "submitted" && <Link className="button-outline" href={`/app/inspections/${record.id}`}>{t.viewInspection}</Link>}
    </div>
  </section>

  const saveText = saveState === "saving" ? t.saving : saveState === "dirty" ? t.unsaved : saveState === "saved" ? `${t.saved} ${savedTime}` : t.noChanges

  return <section className="inspection-runner" dir={rtl ? "rtl" : "ltr"}>
    <div ref={topRef} />
    {!online && <p className="inspection-offline" role="status"><WifiOff size={15} aria-hidden="true" />{t.offline}</p>}
    {message && <p className="inspection-alert" role="alert">{message}</p>}
    {conflict && <div className="inspection-conflict" role="alert"><strong>{t.conflict}</strong>
      <button type="button" onClick={startResolve}>{t.reload}</button>
      <button type="button" onClick={() => { try { const copy = inspectionRepository.create({ workspaceId: record.workspaceId, siteId: record.siteId, templateId: record.templateId, templateVersion: record.templateVersion, title: `${record.title} — ${language === "ar" ? "نسخة" : "copy"}`, inspectorId: record.inspectorId, dueAt: record.dueAt }); const savedCopy = inspectionRepository.saveDraft(copy.id, answersToRows(answers), copy.revision, findings); setRecord(savedCopy); onChange(savedCopy); setConflict(false); setMessage(`${t.copyChanges}: ${savedCopy.id}`) } catch (error) { setMessage(errorMessage(language, error)) } }}>{t.copyChanges}</button></div>}

    <header className="runner-header">
      <button type="button" className="inspection-back" onClick={onExit}><ArrowLeft size={16} aria-hidden="true" />{t.backWork}</button>
      <p className="eyebrow">{record.id} · v{record.templateVersion} <span className={`sync-badge is-${syncState}`}>{stateLabel[syncState]}</span></p>
      <h1>{template?.title[language] ?? record.title}</h1>
      <div className="runner-progress-copy"><span>{answeredCount}/{totalCount} {t.answered}</span><span>{formatNumber(progress, language)}%</span></div>
      <div className="runner-progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${answeredCount}/${totalCount} ${t.answered}`}><span style={{ width: `${progress}%` }} /></div>
      <nav className="ux-section-nav" aria-label={t.sectionsLabel}>{sections.map((section, index) => {
        const missing = sectionMissing(section.id); const active = !showReview && index === sectionIndex
        return <button type="button" key={section.id} className={`${active ? "is-active" : ""}${missing === 0 && questionsOf(section.id).length ? " is-complete" : ""}`} aria-current={active ? "step" : undefined} onClick={() => goToSection(index)} title={section.title[language] || section.title.en}>{missing === 0 && questionsOf(section.id).length ? <Check size={14} aria-hidden="true" /> : formatNumber(index + 1, language)}<span>{section.title[language] || section.title.en}</span></button>
      })}<button type="button" className={`ux-section-review${showReview ? " is-active" : ""}`} aria-current={showReview ? "step" : undefined} onClick={() => { setAttempted(true); setShowReview(true) }}>{t.reviewSubmit}</button></nav>
    </header>

    {showReview ? <div className="runner-review">
      <h2>{t.reviewSubmit}</h2>
      <p className="ux-review-summary">{answeredCount}/{totalCount} {t.answered} · {plural(language, "finding", findings.length)}</p>
      {errors.length > 0 && <div role="alert" className="runner-errors"><strong>{(errors.length === 1 ? t.missingOne : t.missingN).replace("{n}", formatNumber(errors.length, language))}</strong><ul>{errors.map(({ question, message: error }) => <li key={question.id}><button type="button" onClick={() => jumpTo(question)}>{questionLabel(question, language)}</button><span>{error}</span></li>)}</ul></div>}
      {sections.map((section, index) => <section key={section.id} className="ux-review-section"><div className="ux-review-section-head"><h3>{section.title[language] || section.title.en}</h3><button type="button" className="ux-link" onClick={() => goToSection(index)}>{t.editSection}</button></div>
        {questionsOf(section.id).map((question) => <div className="inspection-answer-row" key={question.id}><strong>{questionLabel(question, language)}</strong>{question.type === "signature" && typeof values[question.id] === "string" && values[question.id] ? <span className="runner-review-signature"><img src={String(values[question.id])} alt={questionLabel(question, language)} /><small>{t.signedDrawn}. {t.signedBy} {record.inspectorId}{signedAt[question.id] ? ` ${t.signedOn} ${new Intl.DateTimeFormat(language === "ar" ? "ar" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(signedAt[question.id]))}` : ""}</small></span> : <span>{formatReviewAnswer(question, values[question.id], language)}</span>}</div>)}</section>)}
      {findings.length > 0 && <section className="ux-review-section"><h3>{t.findingsTab}</h3>{findings.map((finding) => <div className="inspection-answer-row" key={finding.id}><strong>{finding.title}</strong><span>{finding.priority}</span></div>)}</section>}
      <p className="ux-submit-hint" role="status">{errors.length ? t.submitBlocked : ""}</p>
    </div> : <>
      <div className="runner-section-heading"><span>{t.start} {formatNumber(sectionIndex + 1, language)} {t.of} {formatNumber(sections.length, language)}</span><h2>{currentSection?.title[language] || currentSection?.title.en || t.noQuestions}</h2><p>{currentSection?.description[language] || currentSection?.description.en}</p></div>
      {visibleQuestions.length ? <div className="runner-questions">{visibleQuestions.map((question) => {
        const error = errorOf(question); const show = error && (touched.has(question.id) || attempted)
        if (question.type === "instruction") return <aside className="runner-instruction" key={question.id}>{(question.config.content as { en?: string; ar?: string } | undefined)?.[language] || (question.config.content as { en?: string } | undefined)?.en || questionLabel(question, language)}</aside>
        const flagged = findings.filter((finding) => finding.questionId === question.id).length
        return <article className={`runner-question${show ? " has-error" : ""}`} id={`question-${question.id}`} key={question.id}>
          <div className="runner-question-title"><span className="ux-qnum">{String(visibleQuestions.filter((item) => item.type !== "instruction").indexOf(question) + 1).padStart(2, "0")}</span><label htmlFor={`input-${question.id}`}>{questionLabel(question, language)}{runtime[question.id]?.required && <b aria-label={t.required}> *</b>}</label>
            <button type="button" className={`runner-raise${flagged ? " is-flagged" : ""}`} onClick={() => { setFlagging(question); setDraftFinding({ title: questionLabel(question, language), description: "", priority: "medium", photo: "" }) }} aria-label={`${t.flagIssue}: ${questionLabel(question, language)}`}><Flag size={14} aria-hidden="true" />{flagged ? `${formatNumber(flagged, language)} ${t.flagged}` : t.flagIssue}</button></div>
          {question.help[language] && <p className="ux-help">{question.help[language]}</p>}
          {field(question)}
          {show && <small className="runner-error" role="alert"><AlertTriangle size={13} aria-hidden="true" />{error}</small>}
        </article> })}</div> : <p className="inspection-empty">{t.noQuestions}</p>}
    </>}

    <footer className="runner-footer">
      <span className={`ux-save-state ux-save-${saveState}`} role="status">{saveText}</span>
      <div className="ux-footer-buttons">
        <button type="button" className="button-outline" disabled={!showReview && sectionIndex === 0} onClick={() => (showReview ? goToSection(sections.length - 1) : goToSection(sectionIndex - 1))}>{rtl ? <ChevronRight size={16} aria-hidden="true" /> : <ChevronLeft size={16} aria-hidden="true" />}{t.back}</button>
        <button type="button" className="button-outline" onClick={() => persist()}>{t.save}</button>
        {showReview ? <button type="button" className="button-primary" disabled={submitting} aria-busy={submitting} onClick={submitNow}>{submitting ? t.submitting : t.submit}</button>
          : <button type="button" className="button-primary" onClick={goNext}>{sectionIndex < sections.length - 1 ? t.next : t.reviewSubmit}{rtl ? <ChevronLeft size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}</button>}
      </div>
    </footer>

    {flagging && <Dialog title={t.raise} closeLabel={t.cancel} onClose={() => setFlagging(null)}>
      <label>{t.title}<input data-autofocus value={draftFinding.title} onChange={(event) => setDraftFinding({ ...draftFinding, title: event.target.value })} /></label>
      <label>{t.description}<textarea value={draftFinding.description} onChange={(event) => setDraftFinding({ ...draftFinding, description: event.target.value })} /></label>
      <label>{t.priority}<select value={draftFinding.priority} onChange={(event) => setDraftFinding({ ...draftFinding, priority: event.target.value as InspectionFinding["priority"] })}><option value="low">{language === "ar" ? "منخفضة" : "Low"}</option><option value="medium">{language === "ar" ? "متوسطة" : "Medium"}</option><option value="high">{language === "ar" ? "عالية" : "High"}</option></select></label>
      <label>{t.photo}<input type="file" accept="image/*" capture="environment" onChange={(event) => setDraftFinding({ ...draftFinding, photo: event.target.files?.[0]?.name ?? "" })} /></label>
      <div className="inspection-modal-actions"><button type="button" className="button-outline" onClick={() => setFlagging(null)}>{t.cancel}</button><button type="button" className="button-primary" disabled={!draftFinding.title.trim()} onClick={addFinding}>{t.saveFinding}</button></div>
    </Dialog>}
  </section>
}

function formatReviewAnswer(question: Question, value: unknown, language: Language) {
  const t = words[language]
  if (!isAnswered(value)) return "—"
  if (typeof value === "boolean") return value ? t.yes : t.no
  if (question.type === "single_select" || question.type === "multi_select") return (Array.isArray(value) ? value : [value]).map((id) => question.config.choices?.find((choice) => choice.id === id)?.label[language] ?? String(id)).join(", ")
  if (Array.isArray(value)) return value.map((file) => (typeof file === "string" ? file : (file as File).name ?? "Evidence")).join(", ")
  return String(value)
}
