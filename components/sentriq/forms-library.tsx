"use client"

import { useEffect, useMemo, useState } from "react"
import { Archive, Copy, FilePlus2, FileText, MoreHorizontal, RotateCcw, Search } from "lucide-react"
import { InspectionBuilder } from "@/components/sentriq/inspection-builder"

type FormStatus = "Draft" | "Published" | "Archived"
type FormRow = { id: string; en: string; ar: string; category: string; status: FormStatus; sections: number; questions: number; version: string; modified: string; owner: string }
const storageKey = "sentriq-forms-library-demo-v1"
const seed: FormRow[] = [
  { id: "fire-safety", en: "Fire Safety Inspection", ar: "فحص السلامة من الحريق", category: "Emergency readiness", status: "Published", sections: 5, questions: 28, version: "2.1", modified: "Nov 16, 2026", owner: "Mariam Hassan" },
  { id: "warehouse-safety", en: "Warehouse Safety Inspection", ar: "فحص سلامة المستودع", category: "Health & safety", status: "Published", sections: 6, questions: 42, version: "1.4", modified: "Nov 14, 2026", owner: "Omar Khalid" },
  { id: "electrical-safety", en: "Electrical Safety Inspection", ar: "فحص السلامة الكهربائية", category: "Equipment", status: "Draft", sections: 4, questions: 19, version: "Draft", modified: "Nov 18, 2026", owner: "Leila Mansour" },
  { id: "emergency-preparedness", en: "Emergency Preparedness Inspection", ar: "فحص الاستعداد للطوارئ", category: "Emergency readiness", status: "Published", sections: 4, questions: 31, version: "1.0", modified: "Nov 12, 2026", owner: "Yusuf Rahman" },
  { id: "ppe-inspection", en: "Personal Protective Equipment Inspection", ar: "فحص معدات الوقاية الشخصية", category: "Health & safety", status: "Draft", sections: 3, questions: 16, version: "Draft", modified: "Nov 18, 2026", owner: "Aisha Nasser" },
]

export function FormsLibrary() {
  const [forms, setForms] = useState<FormRow[]>(seed)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [openingName, setOpeningName] = useState("")
  const [filter, setFilter] = useState<FormStatus | "All">("All")
  const [search, setSearch] = useState("")
  const [notice, setNotice] = useState("")
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    try { const stored = localStorage.getItem(storageKey); if (stored) setForms(JSON.parse(stored) as FormRow[]) } catch { /* keep synthetic starter records */ }
    setHydrated(true)
  }, [])
  useEffect(() => { if (hydrated) try { localStorage.setItem(storageKey, JSON.stringify(forms)) } catch { setNotice("Local demo storage is unavailable in this browser.") } }, [forms, hydrated])
  const shown = useMemo(() => forms.filter((form) => (filter === "All" || form.status === filter) && `${form.en} ${form.ar} ${form.category} ${form.owner}`.toLowerCase().includes(search.toLowerCase())), [filter, forms, search])
  const duplicate = (form: FormRow) => { setForms((items) => [{ ...form, id: `${form.id}-${Date.now()}`, en: `${form.en} (copy)`, ar: `${form.ar} (نسخة)`, status: "Draft", version: "Draft", modified: "Just now" }, ...items]); setNotice("Template duplicated as a local draft.") }
  const setStatus = (form: FormRow, status: FormStatus) => { setForms((items) => items.map((item) => item.id === form.id ? { ...item, status, modified: "Just now" } : item)); setNotice(status === "Archived" ? "Template archived in this browser." : "Template restored to its previous library status as a draft.") }
  const saveNew = (name: string) => { setForms((items) => [{ id: `new-${Date.now()}`, en: name || "Untitled form", ar: "نموذج جديد", category: "Custom", status: "Draft", sections: 1, questions: 1, version: "Draft", modified: "Just now", owner: "Current user (demo)" }, ...items]); setNotice("Draft added to this browser’s forms library.") }
  return <section className="forms-library" aria-labelledby="forms-library-title">
    <div className="forms-library-heading"><div><p className="eyebrow">SENTRIQ WORKSPACE</p><h1 id="forms-library-title">Forms library</h1><p>Manage reusable inspection templates and their local demo drafts.</p></div><button className="button-primary" onClick={() => { setOpeningName(""); setBuilderOpen(true) }}><FilePlus2 size={16} /> Create new form</button></div>
    <div className="forms-library-tools"><label className="forms-search"><Search size={16} /><input aria-label="Search forms in English or Arabic" placeholder="Search by English or Arabic title…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><div className="forms-filters" role="group" aria-label="Filter by status">{(["All", "Draft", "Published", "Archived"] as const).map((status) => <button key={status} className={filter === status ? "active" : ""} aria-pressed={filter === status} onClick={() => setFilter(status)}>{status}{status === "All" && <span>{forms.length}</span>}</button>)}</div></div>
    {notice && <p className="forms-notice" role="status">{notice} <button onClick={() => setNotice("")} aria-label="Dismiss notice">×</button></p>}
    <div className="forms-table-wrap"><table className="forms-table"><thead><tr><th>Template</th><th>Category</th><th>Structure</th><th>Version</th><th>Last modified</th><th>Owner / editor</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{shown.map((form) => <tr key={form.id}><td><button className="form-title-button" onClick={() => { setOpeningName(form.en); setBuilderOpen(true) }}><span className="form-file-icon"><FileText size={17} /></span><span><strong>{form.en}</strong><small lang="ar" dir="rtl">{form.ar}</small></span></button></td><td>{form.category}</td><td>{form.sections} sections · {form.questions} questions</td><td>{form.version}</td><td>{form.modified}</td><td>{form.owner}</td><td><span className={`form-status status-${form.status.toLowerCase()}`}>{form.status}</span></td><td><div className="form-row-actions"><button aria-label={`Open ${form.en}`} title="Open form" onClick={() => { setOpeningName(form.en); setBuilderOpen(true) }}><FileText size={15} /></button><button aria-label={`Duplicate ${form.en}`} title="Duplicate" onClick={() => duplicate(form)}><Copy size={15} /></button>{form.status === "Archived" ? <button aria-label={`Restore ${form.en}`} title="Restore" onClick={() => setStatus(form, "Draft")}><RotateCcw size={15} /></button> : <button aria-label={`${form.status === "Draft" ? "Archive" : "Archive"} ${form.en}`} title="Archive" onClick={() => setStatus(form, "Archived")}><Archive size={15} /></button>}</div></td></tr>)}</tbody></table>{shown.length === 0 && <div className="forms-empty"><FileText size={22} /><strong>No forms match this view</strong><span>Try another search or status filter.</span></div>}</div>
    <p className="forms-local-note"><MoreHorizontal size={14} /> Demonstration data and changes are saved only in this browser. This is not server storage or a permissions system.</p>
    {builderOpen && <InspectionBuilder initialName={openingName || undefined} onSaved={saveNew} onClose={() => setBuilderOpen(false)} />}
  </section>
}
