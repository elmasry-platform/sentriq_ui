export const FIELD_TYPES = ["short_text", "long_text", "integer", "decimal", "date", "time", "datetime", "boolean", "single_select", "multi_select", "reference", "user", "site", "location", "photo", "file", "attestation", "signature", "instruction", "gps", "barcode_qr", "calculated", "repeat_group"] as const
export type FieldType = typeof FIELD_TYPES[number]
export type Choice = { id: string; label: { en: string; ar: string }; score: number | null; finding: boolean }
export type ChildField = { id: string; type: "short_text" | "long_text" | "integer" | "decimal" | "date" | "boolean"; label: { en: string; ar: string }; required: boolean; config: Record<string, unknown> }
export type FieldConfig = Record<string, unknown> & { choices?: Choice[]; children?: ChildField[]; formula?: string; dependencies?: string[] }
export type Condition = { id: string; sourceQuestionId: string; operator: string; value: string | number | boolean; targetQuestionId: string; effect: "show" | "hide" | "require" | "require_evidence" }
export type Question = { id: string; sectionId: string; type: FieldType; title: { en: string; ar: string }; help: { en: string; ar: string }; required: boolean; validation: { min?: number; max?: number; pattern?: string; maxLength?: number }; config: FieldConfig; conditions: Condition[]; scoring: { weight: number; included: boolean; passValue?: string | boolean | number; naAllowed: boolean; unknownAllowed: boolean; denominator: "answered" | "all" } }
export type FormSection = { id: string; title: { en: string; ar: string }; description: { en: string; ar: string }; questionIds: string[] }
export type FormDefinition = { id: string; draftId: string; title: { en: string; ar: string }; category: string; status: "Draft" | "Published" | "Archived"; sections: FormSection[]; questions: Question[]; revision: number; modifiedAt: string; publishedVersions: PublishedVersion[]; archivedFrom?: "Draft" | "Published" }
export type PublishedVersion = { id: string; version: number; publishedAt: string; snapshot: Omit<FormDefinition, "publishedVersions"> }
export const newId = (prefix = "id") => `${prefix}_${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`
export const emptyForm = (): FormDefinition => ({ id: newId("form"), draftId: newId("draft"), title: { en: "Untitled form", ar: "نموذج بدون عنوان" }, category: "Custom", status: "Draft", sections: [{ id: newId("section"), title: { en: "Section 1", ar: "القسم ١" }, description: { en: "", ar: "" }, questionIds: [] }], questions: [], revision: 0, modifiedAt: new Date().toISOString(), publishedVersions: [] })
export const createQuestion = (type: FieldType, sectionId: string): Question => ({ id: newId("question"), sectionId, type, title: { en: `New ${type.replaceAll("_", " ")} question`, ar: "سؤال جديد" }, help: { en: "", ar: "" }, required: false, validation: {}, config: defaultConfig(type), conditions: [], scoring: { weight: 1, included: type !== "instruction", naAllowed: false, unknownAllowed: false, denominator: "answered" } })
export function defaultConfig(type: FieldType): FieldConfig {
  switch (type) {
    case "short_text": return { placeholder: "", minLength: 0, maxLength: 160 }
    case "long_text": return { placeholder: "", maxLength: 2000 }
    case "integer": return { min: undefined, max: undefined }
    case "decimal": return { min: undefined, max: undefined, unit: "", precision: 2, displayFormat: "number" }
    case "date": return { minDate: "", maxDate: "" }
    case "time": return { format: "24h", meaning: "local_time" }
    case "datetime": return { timezone: "UTC", meaning: "absolute_instant" }
    case "boolean": return { yesLabel: { en: "Yes", ar: "نعم" }, noLabel: { en: "No", ar: "لا" }, yesMeaning: "positive", noMeaning: "negative", passValue: true, findingOn: false }
    case "single_select": case "multi_select": return { choices: [{ id: newId("choice"), label: { en: "Option 1", ar: "الخيار ١" }, score: null, finding: false }, { id: newId("choice"), label: { en: "Option 2", ar: "الخيار ٢" }, score: null, finding: false }], countPolicy: "each_choice" }
    case "reference": return { recordTypes: ["Inspection", "Finding"], workspaceScoped: true }
    case "user": return { activeOnly: true, workspaceScoped: true }
    case "site": return { workspaceScoped: true }
    case "location": return { placeholder: "Building, floor, or area" }
    case "photo": return { maxBytes: 10485760, maxFiles: 5, mimeTypes: ["image/jpeg", "image/png", "image/webp"], preview: true }
    case "file": return { maxBytes: 10485760, maxFiles: 3, mimeTypes: ["application/pdf"] }
    case "attestation": return { statement: { en: "I confirm this information is accurate.", ar: "أؤكد دقة هذه المعلومات." } }
    case "signature": return { notice: "Drawing preview only; not a certified electronic signature." }
    case "instruction": return { content: { en: "Information for the inspector", ar: "معلومات للمفتش" } }
    case "gps": return { precision: 6, manualEntry: true }
    case "barcode_qr": return { pattern: "", maxLength: 128, manualEntry: true }
    case "calculated": return { formula: "", dependencies: [], precision: 2, rounding: "half_up" }
    case "repeat_group": return { minRows: 0, maxRows: 10, children: [] }
  }
}
export function answerableCount(form: Pick<FormDefinition, "questions">): number { return form.questions.filter((question) => question.type !== "instruction").length }
export function canAddAnswerable(form: Pick<FormDefinition, "questions">): boolean { return answerableCount(form) < 150 }
export function duplicateForm(form: FormDefinition): FormDefinition {
  const formId = newId("form"), sectionIds = new Map(form.sections.map((s) => [s.id, newId("section")])), questionIds = new Map(form.questions.map((q) => [q.id, newId("question")]))
  const sections = structuredClone(form.sections).map((s) => ({ ...s, id: sectionIds.get(s.id)!, questionIds: s.questionIds.map((id) => questionIds.get(id) ?? id) }))
  const questions = structuredClone(form.questions).map((q) => ({ ...q, id: questionIds.get(q.id)!, sectionId: sectionIds.get(q.sectionId) ?? q.sectionId, config: remapConfig(q.config, questionIds), conditions: q.conditions.map((rule) => ({ ...rule, id: newId("rule"), sourceQuestionId: questionIds.get(rule.sourceQuestionId) ?? rule.sourceQuestionId, targetQuestionId: questionIds.get(rule.targetQuestionId) ?? rule.targetQuestionId })) }))
  return { ...structuredClone(form), id: formId, draftId: newId("draft"), title: { en: `${form.title.en} (copy)`, ar: `${form.title.ar} (نسخة)` }, status: "Draft", sections, questions, revision: 0, modifiedAt: new Date().toISOString(), publishedVersions: [] }
}
function remapConfig(config: FieldConfig, ids: Map<string, string>): FieldConfig { const copy = structuredClone(config); if (copy.dependencies) copy.dependencies = copy.dependencies.map((id) => ids.get(id) ?? id); if (typeof copy.formula === "string") for (const [oldId, newId] of ids) copy.formula = copy.formula.replaceAll(`{{${oldId}}}`, `{{${newId}}}`); if (Array.isArray(copy.children)) copy.children = copy.children.map((child) => ({ ...child, id: newId("child") })); if (Array.isArray(copy.choices)) copy.choices = copy.choices.map((choice) => ({ ...choice, id: newId("choice") })); return copy }
export function validateQuestion(question: Question): string[] {
  const errors: string[] = []
  if (!question.title.en.trim() && !question.title.ar.trim()) errors.push("Question needs an English or Arabic title.")
  if (question.type === "single_select" || question.type === "multi_select") { const choices = question.config.choices ?? []; if (choices.length < 2 || choices.some((choice) => !choice.label.en.trim() && !choice.label.ar.trim())) errors.push("Add at least two labeled choices.") }
  if (question.type === "integer" && question.config.min != null && question.config.max != null && Number(question.config.min) > Number(question.config.max)) errors.push("Minimum cannot exceed maximum.")
  if (question.type === "decimal" && (!Number.isInteger(Number(question.config.precision)) || Number(question.config.precision) < 0 || Number(question.config.precision) > 10)) errors.push("Precision must be between 0 and 10.")
  if (question.type === "gps" && question.config.manualEntry !== true) errors.push("GPS coordinates must be entered manually in this preview.")
  if (question.type === "repeat_group") { const children = question.config.children ?? []; if (children.length === 0) errors.push("Repeat groups need at least one child field."); if (children.some((child) => !["short_text", "long_text", "integer", "decimal", "date", "boolean"].includes(child.type))) errors.push("Repeat group contains an unsupported child type."); if (Number(question.config.minRows) > Number(question.config.maxRows)) errors.push("Minimum rows cannot exceed maximum rows.") }
  if (question.type === "barcode_qr" && question.config.pattern) { try { new RegExp(String(question.config.pattern)) } catch { errors.push("Barcode validation pattern is not a valid regular expression.") } }
  return errors
}
export function validateForm(form: FormDefinition): { questionId?: string; message: string }[] { const errors: { questionId?: string; message: string }[] = []; if (!form.title.en.trim() && !form.title.ar.trim()) errors.push({ message: "Add a form title." }); if (!answerableCount(form)) errors.push({ message: "Add at least one answerable question." }); if (answerableCount(form) > 150) errors.push({ message: "A form cannot exceed 150 answerable questions." }); for (const q of form.questions) for (const message of validateQuestion(q)) errors.push({ questionId: q.id, message }); for (const q of form.questions) for (const rule of q.conditions) { if (rule.sourceQuestionId === q.id || rule.targetQuestionId === q.id) errors.push({ questionId: q.id, message: "A rule cannot reference itself." }); if (!form.questions.some((item) => item.id === rule.sourceQuestionId || item.id === rule.targetQuestionId)) errors.push({ questionId: q.id, message: "A rule references a question that no longer exists." }) } return errors }
export function validateAnswer(question: Question, value: unknown): string | undefined { if ((value === "" || value == null) && question.required && question.type !== "instruction") return "This field is required."; if (value === "" || value == null) return; if (question.type === "integer" && (!Number.isInteger(Number(value)) || !Number.isFinite(Number(value)))) return "Enter a whole number."; if (question.type === "decimal" && (!Number.isFinite(Number(value)) || Number(value) < Number(question.config.min ?? -Infinity) || Number(value) > Number(question.config.max ?? Infinity) || Number(String(value).split(".")[1]?.length ?? 0) > Number(question.config.precision ?? 2))) return "Enter a number within the configured bounds and precision."; if (question.type === "date" && (Number.isNaN(Date.parse(String(value))) || new Date(String(value)).toISOString().slice(0, 10) !== value)) return "Enter a valid date."; if (question.type === "gps") { const [lat, lon] = String(value).split(",").map(Number); if (lat < -90 || lat > 90 || lon < -180 || lon > 180 || !Number.isFinite(lat) || !Number.isFinite(lon)) return "Enter latitude (−90 to 90) and longitude (−180 to 180)." } if (question.type === "barcode_qr" && question.config.pattern) { try { if (!new RegExp(String(question.config.pattern)).test(String(value))) return "Code does not match the configured pattern." } catch { return "Configured pattern is invalid." } } if (question.validation.maxLength && String(value).length > question.validation.maxLength) return `Maximum length is ${question.validation.maxLength}.`; return }
export function evaluateConditions(form: FormDefinition, answers: Record<string, unknown>): Set<string> { const visible = new Set(form.questions.map((q) => q.id)); for (const target of form.questions) for (const rule of target.conditions) { const source = form.questions.find((q) => q.id === rule.sourceQuestionId); if (!source) continue; const answer = answers[source.id]; const match = rule.operator === "equals" ? answer === rule.value : rule.operator === "not_equals" ? answer !== rule.value : rule.operator === "contains" ? Array.isArray(answer) && answer.includes(rule.value) : false; if (match && rule.effect === "hide") visible.delete(target.id) } return visible }
