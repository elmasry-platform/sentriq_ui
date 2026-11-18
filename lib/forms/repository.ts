import { answerableCount, duplicateForm, emptyForm, type FormDefinition } from "./domain"

const STORAGE_KEY = "sentriq.forms.repository.v2"
const LEGACY_KEY = "sentriq-forms-library-demo-v1"
type StoredData = { schemaVersion: 2; forms: FormDefinition[] }
export interface FormRepository { list(): FormDefinition[]; get(id: string): FormDefinition | undefined; save(form: FormDefinition): FormDefinition; duplicate(id: string): FormDefinition | undefined; setStatus(id: string, status: FormDefinition["status"]): void }
export class LocalFormRepository implements FormRepository {
  private read(): StoredData {
    if (typeof localStorage === "undefined") return { schemaVersion: 2, forms: [] }
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) { const parsed = JSON.parse(raw) as Partial<StoredData>; if (parsed.schemaVersion === 2 && Array.isArray(parsed.forms)) return parsed as StoredData }
      const legacy = localStorage.getItem(LEGACY_KEY)
      if (legacy) {
        const forms = (JSON.parse(legacy) as { id?: string; en?: string; ar?: string; category?: string; status?: string }[]).map((row) => { const form = emptyForm(); return { ...form, id: row.id || form.id, title: { en: row.en || "Untitled form", ar: row.ar || "نموذج بدون عنوان" }, category: row.category || "Custom", status: (row.status === "Published" || row.status === "Archived" ? row.status : "Draft") as FormDefinition["status"] } })
        const migrated = { schemaVersion: 2 as const, forms }; this.write(migrated); return migrated
      }
    } catch { throw new Error("Saved form data could not be read. It has not been overwritten.") }
    return { schemaVersion: 2, forms: [] }
  }
  private write(data: StoredData) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch { throw new Error("Your changes could not be saved in this browser. Check available storage and try again.") } }
  list() { return structuredClone(this.read().forms) }
  get(id: string) { return structuredClone(this.read().forms.find((form) => form.id === id)) }
  save(form: FormDefinition) { const data = this.read(); const saved = { ...structuredClone(form), revision: form.revision + 1, modifiedAt: new Date().toISOString() }; const index = data.forms.findIndex((item) => item.id === saved.id); if (index < 0) data.forms.unshift(saved); else data.forms[index] = saved; this.write(data); return structuredClone(saved) }
  duplicate(id: string) { const source = this.get(id); if (!source) return; const copy = duplicateForm(source); const data = this.read(); data.forms.unshift(copy); this.write(data); return copy }
  setStatus(id: string, status: FormDefinition["status"]) { const data = this.read(); const form = data.forms.find((item) => item.id === id); if (!form) return; form.status = status; form.modifiedAt = new Date().toISOString(); this.write(data) }
}
export const formRepository = new LocalFormRepository()
export const formQuestionCount = (form: FormDefinition) => answerableCount(form)
