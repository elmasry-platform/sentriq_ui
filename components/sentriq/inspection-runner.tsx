"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, MapPin, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, Flag, Upload, WifiOff } from "lucide-react"
import { evaluateFormula, getQuestionRuntimeStates, roundCalculated, validateAnswer, type Question } from "@/lib/forms/domain"
import { inspectionRepository, type InspectionFinding, type InspectionRecord } from "@/lib/inspections/repository"
import { errorMessage, formatNumber, plural, type Language } from "@/lib/sentriq/format"
import { words } from "@/lib/sentriq/inspections-i18n"
import { SignaturePad } from "@/components/sentriq/signature-pad"
import { Dialog } from "@/components/sentriq/dialog"
import { answersToRows, isAnswered, questionLabel, type Template } from "@/components/sentriq/inspection-shared"

type SaveState = "clean" | "dirty" | "saving" | "saved"
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
  const [done, setDone] = useState(initial.status === "submitted")
  const [conflict, setConflict] = useState(false)
  const [message, setMessage] = useState("")
  const [saveState, setSaveState] = useState<SaveState>("clean")
  const [savedTime, setSavedTime] = useState("")
  const [online, setOnline] = useState(true)
  const [queuedOffline, setQueuedOffline] = useState(false)
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
  const runtime = useMemo(() => (form ? getQuestionRuntimeStates(form, values) : {}), [form, values])
  const shown = (question: Question) => Boolean(runtime[question.id]?.visible)
  const answerable = (question: Question) => question.type !== "instruction" && shown(question)
  const questionsOf = (sectionId: string) => (sections.find((section) => section.id === sectionId)?.questionIds ?? []).map((id) => form?.questions.find((item) => item.id === id)).filter((question): question is Question => Boolean(question && answerable(question)))
  const errorOf = (question: Question) => validateAnswer({ ...question, required: runtime[question.id]?.required ?? question.required }, values[question.id])
  const visibleQuestions = currentSection ? (currentSection.questionIds.map((id) => form?.questions.find((item) => item.id === id)).filter((question): question is Question => Boolean(question && shown(question)))) : []
  const allQuestions = sections.flatMap((section) => questionsOf(section.id))
  const errors = allQuestions.map((question) => ({ question, message: errorOf(question) })).filter((item) => item.message)
  const answeredCount = allQuestions.filter((question) => isAnswered(values[question.id])).length
  const totalCount = allQuestions.length
  const progress = totalCount ? Math.round((answeredCount / totalCount) * 100) : 0
  const sectionMissing = (sectionId: string) => questionsOf(sectionId).filter((question) => errorOf(question)).length

  const mark = (id: string) => setTouched((current) => new Set(current).add(id))
  const setAnswer = (question: Question, value: unknown) => { setAnswers((current) => ({ ...current, [question.id]: value })); mark(question.id); setSaveState("dirty") }

  const persist = (submit = false) => {
    setSaveState("saving")
    try {
      const rows = answersToRows(values)
      const next = submit ? inspectionRepository.submit(record.id, rows, record.revision, findings) : inspectionRepository.saveDraft(record.id, rows, record.revision, findings)
      setRecord(next); onChange(next); setConflict(false); setMessage("")
      setSavedTime(new Intl.DateTimeFormat(language === "ar" ? "ar" : "en", { hour: "2-digit", minute: "2-digit" }).format(new Date()))
      setSaveState("saved")
      if (submit) { setQueuedOffline(!navigator.onLine); setDone(true) }
      return next
    } catch (error) {
      setSaveState("dirty")
      if ((error as { code?: string }).code === "STALE_REVISION") setConflict(true)
      else setMessage(errorMessage(language, error))
      return undefined
    }
  }

  useEffect(() => {
    if (done || saveState !== "dirty") return
    const timer = window.setTimeout(() => persist(false), 10000)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, findings, saveState, done])

  const updateEvidence = (question: Question, files: File[]) => {
    setEvidenceUrls((current) => { current[question.id]?.forEach((url) => URL.revokeObjectURL(url)); return { ...current, [question.id]: files.map((file) => URL.createObjectURL(file)) } })
    setAnswer(question, files)
  }
  useEffect(() => () => Object.values(evidenceUrls).flat().forEach((url) => URL.revokeObjectURL(url)), [evidenceUrls])

  const goToSection = (index: number) => { setShowReview(false); setSectionIndex(index); topRef.current?.scrollIntoView({ block: "start" }) }
  const goNext = () => { setAttempted(true); persist(false); if (sectionIndex < sections.length - 1) goToSection(sectionIndex + 1); else { setShowReview(true); topRef.current?.scrollIntoView({ block: "start" }) } }
  const sectionOfQuestion = (questionId: string) => sections.findIndex((section) => section.questionIds.includes(questionId))

  const addFinding = () => {
    if (!flagging || !draftFinding.title.trim()) return
    setFindings((current) => [...current, { id: `FND-${Date.now()}`, questionId: flagging.id, title: draftFinding.title.trim(), description: draftFinding.description.trim(), priority: draftFinding.priority, photoName: draftFinding.photo || undefined }])
    setSaveState("dirty"); setFlagging(null); setDraftFinding({ title: "", description: "", priority: "medium", photo: "" })
  }

  const [locating, setLocating] = useState("")
  const locate = (question: Question) => {
    if (!navigator.geolocation) { setMessage(t.locationDenied); return }
    setLocating(question.id)
    navigator.geolocation.getCurrentPosition(
      (position) => { const digits = Number(question.config.precision ?? 6); setAnswer(question, `${position.coords.latitude.toFixed(digits)}, ${position.coords.longitude.toFixed(digits)}`); setLocating(""); setMessage("") },
      () => { setLocating(""); setMessage(t.locationDenied) },
      { enableHighAccuracy: true, timeout: 15000 })
  }

  const field = (question: Question) => {
    const value = answers[question.id] ?? ""
    const name = questionLabel(question, language)
    const id = `input-${question.id}`
    if (question.type === "boolean") return <div className="runner-choice-row" role="group" aria-label={name}>{[true, false].map((option) => <button type="button" key={String(option)} className={answers[question.id] === option ? "selected" : ""} aria-pressed={answers[question.id] === option} onClick={() => setAnswer(question, option)}>{answers[question.id] === option && <Check size={16} aria-hidden="true" />}{option ? t.yes : t.no}</button>)}</div>
    if (question.type === "single_select" || question.type === "multi_select") return <div className="runner-options" role={question.type === "single_select" ? "radiogroup" : "group"} aria-label={name}>{(question.config.choices ?? []).map((choice) => {
      const selected = question.type === "multi_select" ? Array.isArray(value) && value.includes(choice.id) : value === choice.id
      return <label className={`runner-option${selected ? " selected" : ""}`} key={choice.id}><input type={question.type === "multi_select" ? "checkbox" : "radio"} name={question.id} checked={selected} onChange={() => setAnswer(question, question.type === "multi_select" ? (selected ? (value as string[]).filter((item) => item !== choice.id) : [...(Array.isArray(value) ? value : []), choice.id]) : choice.id)} /><span>{choice.label[language] || choice.label.en}</span></label>
    })}</div>
    if (question.type === "photo" || question.type === "file") return <div className="runner-evidence"><label className="runner-file" htmlFor={id}><Upload size={20} aria-hidden="true" /><span>{t.photo}</span><input id={id} aria-label={name} type="file" accept={question.type === "photo" ? "image/*" : "*/*"} capture={question.type === "photo" ? "environment" : undefined} multiple={Number(question.config.maxFiles ?? 1) > 1} onChange={(event) => updateEvidence(question, Array.from(event.target.files ?? []))} /></label>
      {Array.isArray(value) && value.length > 0 && <div className="runner-evidence-list">{value.map((file, index) => { const fileName = typeof file === "string" ? file : (file as File).name; return <div className="runner-evidence-item" key={`${fileName}-${index}`}>{question.type === "photo" && evidenceUrls[question.id]?.[index] && <img src={evidenceUrls[question.id][index]} alt={language === "ar" ? `معاينة ${index + 1}` : `Evidence ${index + 1} preview`} />}<span>{fileName}</span><button type="button" aria-label={`${t.remove} ${fileName}`} onClick={() => updateEvidence(question, (value as File[]).filter((_, fileIndex) => fileIndex !== index))}>{t.remove}</button></div> })}</div>}</div>
    if (question.type === "calculated") return <p className="runner-calculated" id={id} role="status"><small>{t.calculatedLabel}</small><strong>{isAnswered(values[question.id]) ? formatNumber(Number(values[question.id]), language) : t.calculatedWait}</strong></p>
    if (question.type === "signature") return <SignaturePad value={typeof value === "string" ? value : ""} label={name} hint={t.signHere} clearLabel={t.clearSignature} signedLabel={t.signed} onChange={(data) => setAnswer(question, data)} />
    if (question.type === "gps") return <div className="runner-gps"><button type="button" className="button-outline" onClick={() => locate(question)}><MapPin size={16} aria-hidden="true" />{locating === question.id ? t.locating : t.useLocation}</button><input id={id} aria-label={name} dir="ltr" inputMode="text" placeholder={t.coordsHint} value={String(value)} onChange={(event) => setAnswer(question, event.target.value)} /></div>
    if (question.type === "attestation") return <label className="runner-option"><input id={id} type="checkbox" checked={value === true} onChange={(event) => setAnswer(question, event.target.checked)} /><span>{(question.config.statement as { en?: string; ar?: string } | undefined)?.[language] ?? name}</span></label>
    if (question.type === "long_text") return <textarea id={id} aria-label={name} value={String(value)} onChange={(event) => setAnswer(question, event.target.value)} rows={4} />
    const type = question.type === "integer" || question.type === "decimal" ? "number" : question.type === "date" ? "date" : question.type === "time" ? "time" : question.type === "datetime" ? "datetime-local" : "text"
    return <input id={id} aria-label={name} type={type} inputMode={type === "number" ? "decimal" : undefined} value={String(value)} onChange={(event) => setAnswer(question, type === "number" ? (event.target.value === "" ? "" : Number(event.target.value)) : event.target.value)} />
  }

  if (done) return <section className="inspection-runner ux-success" dir={rtl ? "rtl" : "ltr"}>
    <span className="ux-success-mark"><CheckCircle2 size={34} aria-hidden="true" /></span>
    <h1>{t.submitted}</h1>
    <p>{queuedOffline ? t.syncing : t.submittedHint}</p>
    <dl className="ux-success-stats"><div><dt>{t.answered}</dt><dd>{formatNumber(answeredCount, language)}/{formatNumber(totalCount, language)}</dd></div><div><dt>{t.findingsTab}</dt><dd>{plural(language, "finding", findings.length)}</dd></div></dl>
    <div className="ux-success-actions">
      {findings.length > 0 && <Link className="button-primary" href={`/app/inspections/${record.id}#findings`}>{t.createActions}<ArrowRight size={16} /></Link>}
      <Link className={findings.length ? "button-outline" : "button-primary"} href={`/app/inspections/${record.id}`}>{t.viewInspection}</Link>
      <Link className="button-outline" href="/app/inspections">{t.backWork}</Link>
    </div>
  </section>

  const saveText = saveState === "saving" ? t.saving : saveState === "dirty" ? t.unsaved : saveState === "saved" ? `${t.saved} ${savedTime}` : t.noChanges

  return <section className="inspection-runner" dir={rtl ? "rtl" : "ltr"}>
    <div ref={topRef} />
    {!online && <p className="inspection-offline" role="status"><WifiOff size={15} aria-hidden="true" />{t.offline}</p>}
    {message && <p className="inspection-alert" role="alert">{message}</p>}
    {conflict && <div className="inspection-conflict" role="alert"><strong>{t.conflict}</strong>
      <button type="button" onClick={() => { const latest = inspectionRepository.get(record.id); if (latest) { setRecord(latest); setAnswers(Object.fromEntries(latest.answers.map((item) => [item.questionId, item.value]))); setFindings(latest.findings ?? []); setConflict(false); setSaveState("clean") } }}>{t.reload}</button>
      <button type="button" onClick={() => { try { const copy = inspectionRepository.create({ workspaceId: record.workspaceId, siteId: record.siteId, templateId: record.templateId, templateVersion: record.templateVersion, title: `${record.title} — ${language === "ar" ? "نسخة" : "copy"}`, inspectorId: record.inspectorId, dueAt: record.dueAt }); const savedCopy = inspectionRepository.saveDraft(copy.id, answersToRows(answers), copy.revision, findings); setRecord(savedCopy); onChange(savedCopy); setConflict(false); setMessage(`${t.copyChanges}: ${savedCopy.id}`) } catch (error) { setMessage(errorMessage(language, error)) } }}>{t.copyChanges}</button></div>}

    <header className="runner-header">
      <button type="button" className="inspection-back" onClick={onExit}><ArrowLeft size={16} aria-hidden="true" />{t.backWork}</button>
      <p className="eyebrow">{record.id} · v{record.templateVersion}</p>
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
      {errors.length > 0 && <div role="alert" className="runner-errors"><strong>{t.requiredMissing}</strong><ul>{errors.map(({ question, message: error }) => <li key={question.id}><button type="button" onClick={() => goToSection(Math.max(0, sectionOfQuestion(question.id)))}>{questionLabel(question, language)}</button><span>{error}</span></li>)}</ul></div>}
      {sections.map((section, index) => <section key={section.id} className="ux-review-section"><div className="ux-review-section-head"><h3>{section.title[language] || section.title.en}</h3><button type="button" className="ux-link" onClick={() => goToSection(index)}>{t.editSection}</button></div>
        {questionsOf(section.id).map((question) => <div className="inspection-answer-row" key={question.id}><strong>{questionLabel(question, language)}</strong><span>{formatReviewAnswer(question, values[question.id], language)}</span></div>)}</section>)}
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
        <button type="button" className="button-outline" onClick={() => persist(false)}>{t.save}</button>
        {showReview ? <button type="button" className="button-primary" disabled={errors.length > 0} onClick={() => persist(true)}>{t.submit}</button>
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
