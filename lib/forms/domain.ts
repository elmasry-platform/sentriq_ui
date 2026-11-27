export const FIELD_TYPES = ["short_text", "long_text", "integer", "decimal", "date", "time", "datetime", "boolean", "single_select", "multi_select", "reference", "user", "site", "location", "photo", "file", "attestation", "signature", "instruction", "gps", "barcode_qr", "calculated", "repeat_group"] as const
export type FieldType = typeof FIELD_TYPES[number]
// Types the inspection runner can answer today. The builder only offers these; the rest are hidden until the runner supports them.
export const RUNNER_FIELD_TYPES: readonly FieldType[] = ["short_text", "long_text", "integer", "decimal", "date", "time", "datetime", "boolean", "single_select", "multi_select", "photo", "file", "attestation", "signature", "instruction", "gps", "calculated"]
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
  if (answerableCount(form) > 150) throw new Error("A form cannot exceed 150 answerable questions.")
  const formId = newId("form"), sectionIds = new Map(form.sections.map((s) => [s.id, newId("section")])), questionIds = new Map(form.questions.map((q) => [q.id, newId("question")]))
  const sections = structuredClone(form.sections).map((s) => ({ ...s, id: sectionIds.get(s.id)!, questionIds: s.questionIds.map((id) => questionIds.get(id) ?? id) }))
  const questions = structuredClone(form.questions).map((q) => ({ ...q, id: questionIds.get(q.id)!, sectionId: sectionIds.get(q.sectionId) ?? q.sectionId, config: remapConfig(q.config, questionIds), conditions: q.conditions.map((rule) => ({ ...rule, id: newId("rule"), sourceQuestionId: questionIds.get(rule.sourceQuestionId) ?? rule.sourceQuestionId, targetQuestionId: questionIds.get(rule.targetQuestionId) ?? rule.targetQuestionId })) }))
  return { ...structuredClone(form), id: formId, draftId: newId("draft"), title: { en: `${form.title.en} (copy)`, ar: `${form.title.ar} (نسخة)` }, status: "Draft", sections, questions, revision: 0, modifiedAt: new Date().toISOString(), publishedVersions: [] }
}
function remapConfig(config: FieldConfig, ids: Map<string, string>): FieldConfig { const copy = structuredClone(config); if (copy.dependencies) copy.dependencies = copy.dependencies.map((id) => ids.get(id) ?? id); if (typeof copy.formula === "string") for (const [oldId, newId] of ids) copy.formula = copy.formula.replaceAll(`{{${oldId}}}`, `{{${newId}}}`); if (Array.isArray(copy.children)) copy.children = copy.children.map((child) => ({ ...child, id: newId("child") })); if (Array.isArray(copy.choices)) copy.choices = copy.choices.map((choice) => ({ ...choice, id: newId("choice") })); return copy }
const SUPPORTED_CHILD_TYPES = new Set<ChildField["type"]>(["short_text", "long_text", "integer", "decimal", "date", "boolean"])
const CONDITION_OPERATORS = new Set(["equals", "not_equals", "contains", "greater_than", "less_than", "is_empty", "is_not_empty"])

export function validateQuestion(question: Question): string[] {
  const errors: string[] = []
  if (!question.title.en.trim() && !question.title.ar.trim()) errors.push("Question needs an English or Arabic title.")
  const numericTypes = new Set(["integer", "decimal"])
  if (numericTypes.has(question.type)) {
    const min = question.config.min == null ? undefined : Number(question.config.min)
    const max = question.config.max == null ? undefined : Number(question.config.max)
    if (min !== undefined && !Number.isFinite(min) || max !== undefined && !Number.isFinite(max)) errors.push("Numeric bounds must be finite numbers.")
    if (min !== undefined && max !== undefined && min > max) errors.push("Minimum cannot exceed maximum.")
  }
  if (question.type === "short_text" || question.type === "long_text") {
    const max = Number(question.config.maxLength)
    const min = Number(question.config.minLength ?? 0)
    if (!Number.isInteger(max) || max < 1 || !Number.isInteger(min) || min < 0 || min > max) errors.push("Text length limits are invalid.")
  }
  if (question.type === "decimal" && (!Number.isInteger(Number(question.config.precision)) || Number(question.config.precision) < 0 || Number(question.config.precision) > 10)) errors.push("Precision must be between 0 and 10.")
  if (question.type === "date") {
    const minDate = String(question.config.minDate ?? ""), maxDate = String(question.config.maxDate ?? "")
    if (minDate && (!/^\d{4}-\d{2}-\d{2}$/.test(minDate) || Number.isNaN(Date.parse(minDate)) || new Date(minDate).toISOString().slice(0, 10) !== minDate)) errors.push("Minimum date must be a valid date.")
    if (maxDate && (!/^\d{4}-\d{2}-\d{2}$/.test(maxDate) || Number.isNaN(Date.parse(maxDate)) || new Date(maxDate).toISOString().slice(0, 10) !== maxDate)) errors.push("Maximum date must be a valid date.")
    if (minDate && maxDate && minDate > maxDate) errors.push("Minimum date cannot be after maximum date.")
  }
  if (question.type === "datetime" && !["absolute_instant", "local_datetime"].includes(String(question.config.meaning))) errors.push("Choose explicit date-time semantics.")
  if (question.type === "time" && !["12h", "24h"].includes(String(question.config.format))) errors.push("Choose a supported time format.")
  if (question.type === "single_select" || question.type === "multi_select") {
    const choices = question.config.choices ?? []
    if (choices.length < 2 || choices.some((choice) => !choice.label.en.trim() && !choice.label.ar.trim())) errors.push("Add at least two labeled choices.")
    if (new Set(choices.map((choice) => choice.id)).size !== choices.length) errors.push("Choice IDs must be unique.")
    if (choices.some((choice) => choice.score !== null && (!Number.isFinite(choice.score) || choice.score < 0))) errors.push("Choice scores must be non-negative finite numbers.")
  }
  if (question.type === "barcode_qr" && (!Number.isInteger(Number(question.config.maxLength)) || Number(question.config.maxLength) < 1)) errors.push("Barcode maximum length must be a positive whole number.")
  if (question.type === "calculated") {
    if (!String(question.config.formula ?? "").trim()) errors.push("Add an arithmetic formula.")
    if (!Number.isInteger(Number(question.config.precision ?? 2)) || Number(question.config.precision ?? 2) < 0 || Number(question.config.precision ?? 2) > 10) errors.push("Calculated precision must be between 0 and 10.")
    if (!["half_up", "half_even", "truncate"].includes(String(question.config.rounding ?? "half_up"))) errors.push("Choose a supported rounding method.")
  }
  if (question.type === "attestation") {
    const statement = question.config.statement as { en?: string; ar?: string } | undefined
    if (!statement?.en?.trim() && !statement?.ar?.trim()) errors.push("Add an acknowledgment statement in English or Arabic.")
  }
  if (question.type === "photo" || question.type === "file") {
    if (!Number.isInteger(Number(question.config.maxFiles)) || Number(question.config.maxFiles) < 1) errors.push("Maximum file count must be a positive whole number.")
    if (!Number.isFinite(Number(question.config.maxBytes)) || Number(question.config.maxBytes) <= 0) errors.push("Maximum file size must be greater than zero.")
    if (!Array.isArray(question.config.mimeTypes) || question.config.mimeTypes.length === 0) errors.push("Select at least one accepted file type.")
  }
  if (question.type === "gps" && question.config.manualEntry !== true) errors.push("GPS coordinates must be entered manually in this preview.")
  if (question.type === "repeat_group") {
    const children = question.config.children ?? []
    const minRows = Number(question.config.minRows), maxRows = Number(question.config.maxRows)
    if (children.length === 0) errors.push("Repeat groups need at least one child field.")
    if (children.some((child) => !SUPPORTED_CHILD_TYPES.has(child.type) || (!child.label.en.trim() && !child.label.ar.trim()))) errors.push("Repeat group contains an unsupported or unlabeled child field.")
    if (!Number.isInteger(minRows) || !Number.isInteger(maxRows) || minRows < 0 || maxRows < 1 || minRows > maxRows) errors.push("Repeat group row limits are invalid.")
  }
  if (question.type === "barcode_qr" && question.config.pattern) { try { new RegExp(String(question.config.pattern)) } catch { errors.push("Barcode validation pattern is not a valid regular expression.") } }
  if (!Number.isFinite(question.scoring.weight) || question.scoring.weight < 0) errors.push("Question scoring weight must be a non-negative number.")
  return errors
}

export function validateForm(form: FormDefinition): { questionId?: string; message: string }[] {
  const errors: { questionId?: string; message: string }[] = []
  if (!form.title.en.trim() && !form.title.ar.trim()) errors.push({ message: "Add a form title." })
  if (!answerableCount(form)) errors.push({ message: "Add at least one answerable question." })
  if (answerableCount(form) > 150) errors.push({ message: "A form cannot exceed 150 answerable questions." })
  const questionIds = new Set(form.questions.map((question) => question.id))
  const sectionIds = new Set(form.sections.map((section) => section.id))
  const formulaDependencies = new Map<string, string[]>()
  const conditionDependencies = new Map<string, string[]>()
  if (new Set(form.questions.map((question) => question.id)).size !== form.questions.length) errors.push({ message: "Question IDs must be unique." })
  for (const section of form.sections) {
    if (new Set(section.questionIds).size !== section.questionIds.length) errors.push({ message: `Section “${section.title.en}” contains duplicate question references.` })
    for (const id of section.questionIds) if (!questionIds.has(id) || form.questions.find((question) => question.id === id)?.sectionId !== section.id) errors.push({ message: `Section “${section.title.en}” has an inconsistent question reference.` })
  }
  for (const question of form.questions) {
    if (!sectionIds.has(question.sectionId)) errors.push({ questionId: question.id, message: "Question must belong to an existing section." })
    if (!form.sections.find((section) => section.id === question.sectionId)?.questionIds.includes(question.id)) errors.push({ questionId: question.id, message: "Question is missing from its section structure." })
    for (const message of validateQuestion(question)) errors.push({ questionId: question.id, message })
    if (question.type === "calculated") {
      const references = [...String(question.config.formula ?? "").matchAll(/\{\{([^{}]+)\}\}/g)].map((match) => match[1])
      formulaDependencies.set(question.id, references)
      for (const dependencyId of references) {
        const dependency = form.questions.find((item) => item.id === dependencyId)
        if (!dependency) errors.push({ questionId: question.id, message: `Formula references unknown question ${dependencyId}.` })
        else if (!["integer", "decimal", "calculated"].includes(dependency.type)) errors.push({ questionId: question.id, message: `Formula dependency ${dependencyId} is not numeric.` })
      }
    }
    for (const rule of question.conditions) {
      const source = form.questions.find((item) => item.id === rule.sourceQuestionId)
      const target = form.questions.find((item) => item.id === rule.targetQuestionId)
      if (!source || !target) errors.push({ questionId: question.id, message: "A rule references a question that no longer exists." })
      if (rule.sourceQuestionId === rule.targetQuestionId) errors.push({ questionId: question.id, message: "A rule cannot use the same question as source and target." })
      if (!CONDITION_OPERATORS.has(rule.operator)) errors.push({ questionId: question.id, message: "A rule uses an unsupported operator." })
      if (source && rule.sourceQuestionId !== rule.targetQuestionId) conditionDependencies.set(rule.targetQuestionId, [...(conditionDependencies.get(rule.targetQuestionId) ?? []), rule.sourceQuestionId])
      if (rule.operator === "contains" && source && source.type !== "multi_select" && source.type !== "single_select" && source.type !== "short_text" && source.type !== "long_text") errors.push({ questionId: question.id, message: "Contains is not supported for this source field." })
      if ((rule.operator === "greater_than" || rule.operator === "less_than") && source && !["integer", "decimal", "date", "time", "datetime"].includes(source.type)) errors.push({ questionId: question.id, message: "Comparison requires a numeric or date/time source field." })
      if (["is_empty", "is_not_empty"].includes(rule.operator) ? rule.value !== "" : rule.value === undefined || rule.value === null) errors.push({ questionId: question.id, message: "A rule needs a valid comparison value." })
      if (source && !["is_empty", "is_not_empty"].includes(rule.operator)) {
        if (["integer", "decimal"].includes(source.type) && !Number.isFinite(Number(rule.value))) errors.push({ questionId: question.id, message: "Numeric conditions need a finite comparison value." })
        if (source.type === "boolean" && typeof rule.value !== "boolean") errors.push({ questionId: question.id, message: "Boolean conditions need a true or false value." })
        if (["single_select", "multi_select"].includes(source.type) && !source.config.choices?.some((choice) => choice.id === rule.value)) errors.push({ questionId: question.id, message: "Choice conditions must reference an existing choice ID." })
        if (source.type === "date" && (typeof rule.value !== "string" || Number.isNaN(Date.parse(rule.value)))) errors.push({ questionId: question.id, message: "Date conditions need a valid date value." })
      }
    }
  }
  const visiting = new Set<string>(), visited = new Set<string>()
  const visitFormula = (id: string): boolean => {
    if (visiting.has(id)) return true
    if (visited.has(id)) return false
    visiting.add(id)
    const cyclic = (formulaDependencies.get(id) ?? []).some((dependency) => formulaDependencies.has(dependency) && visitFormula(dependency))
    visiting.delete(id)
    visited.add(id)
    if (cyclic) errors.push({ questionId: id, message: "Calculated fields cannot contain circular dependencies." })
    return cyclic
  }
  for (const id of formulaDependencies.keys()) visitFormula(id)
  const visitingConditions = new Set<string>(), visitedConditions = new Set<string>()
  const visitCondition = (id: string): boolean => {
    if (visitingConditions.has(id)) return true
    if (visitedConditions.has(id)) return false
    visitingConditions.add(id)
    const cyclic = (conditionDependencies.get(id) ?? []).some(visitCondition)
    visitingConditions.delete(id)
    visitedConditions.add(id)
    if (cyclic) errors.push({ questionId: id, message: "Conditional dependencies cannot form a cycle." })
    return cyclic
  }
  for (const id of conditionDependencies.keys()) visitCondition(id)
  return errors
}

export function validateAnswer(question: Question, value: unknown): string | undefined {
  const empty = value === "" || value == null || Array.isArray(value) && value.length === 0
  if (empty && question.required && question.type !== "instruction") return "This field is required."
  if (empty) return
  const number = Number(value)
  if (question.type === "integer" && (!Number.isInteger(number) || !Number.isFinite(number))) return "Enter a whole number."
  if (question.type === "integer" || question.type === "decimal") {
    if (!Number.isFinite(number) || number < Number(question.config.min ?? -Infinity) || number > Number(question.config.max ?? Infinity)) return "Enter a number within the configured bounds."
    if (question.type === "decimal" && Number(String(value).split(".")[1]?.length ?? 0) > Number(question.config.precision ?? 2)) return "Number exceeds the configured decimal precision."
  }
  if (question.type === "short_text" || question.type === "long_text") {
    const text = String(value)
    if (text.length < Number(question.config.minLength ?? 0)) return `Minimum length is ${question.config.minLength}.`
    if (text.length > Number(question.config.maxLength ?? question.validation.maxLength ?? Infinity)) return `Maximum length is ${question.config.maxLength ?? question.validation.maxLength}.`
  }
  if (question.type === "date") {
    const text = String(value)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(text)) || new Date(text).toISOString().slice(0, 10) !== text) return "Enter a valid date."
    if (question.config.minDate && text < String(question.config.minDate) || question.config.maxDate && text > String(question.config.maxDate)) return "Date is outside the configured range."
  }
  if (question.type === "datetime" && (Number.isNaN(Date.parse(String(value))) || !String(value).includes("T"))) return "Enter a valid date and time."
  if (question.type === "time" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value))) return "Enter a valid time in 24-hour format."
  if (question.type === "gps") { const [lat, lon] = String(value).split(",").map(Number); if (lat < -90 || lat > 90 || lon < -180 || lon > 180 || !Number.isFinite(lat) || !Number.isFinite(lon)) return "Enter latitude (−90 to 90) and longitude (−180 to 180)." }
  if (question.type === "single_select" || question.type === "multi_select") {
    const validIds = new Set((question.config.choices ?? []).map((choice) => choice.id))
    if (question.type === "multi_select" && !Array.isArray(value)) return "Choose one or more valid options."
    const selections = Array.isArray(value) ? value : [value]
    if (question.type === "single_select" && selections.length !== 1 || new Set(selections).size !== selections.length || selections.some((item) => typeof item !== "string" || !validIds.has(item))) return "Choose a valid option."
  }
  if (question.type === "photo" || question.type === "file") {
    const files = Array.isArray(value) ? value as File[] : []
    if (!Array.isArray(value)) return "Choose one or more files."
    if (files.length > Number(question.config.maxFiles ?? 1)) return `Choose no more than ${question.config.maxFiles} files.`
    const accepted = question.config.mimeTypes as string[] | undefined
    if (files.some((file) => file.size > Number(question.config.maxBytes ?? Infinity))) return "A selected file exceeds the configured size limit."
    if (accepted?.length && files.some((file) => !accepted.some((type) => type.endsWith("/*") ? file.type.startsWith(type.slice(0, -1)) : type === file.type))) return "A selected file has an unsupported type."
  }
  if (question.type === "barcode_qr") {
    if (String(value).length > Number(question.config.maxLength ?? 128)) return "Code is longer than the configured maximum."
    if (question.config.pattern) { try { if (!new RegExp(String(question.config.pattern)).test(String(value))) return "Code does not match the configured pattern." } catch { return "Configured pattern is invalid." } }
  }
  if (question.type === "repeat_group") {
    if (!Array.isArray(value)) return "Enter repeating rows."
    if (value.length < Number(question.config.minRows ?? 0) || value.length > Number(question.config.maxRows ?? 10)) return "Row count is outside the configured range."
    const children = question.config.children ?? []
    for (const [rowIndex, row] of value.entries()) {
      for (const child of children) {
        const childValue = row && typeof row === "object" ? (row as Record<string, unknown>)[child.id] : undefined
        if (child.required && (childValue == null || childValue === "")) return `Row ${rowIndex + 1}: ${child.label.en || child.label.ar} is required.`
        if (child.type === "integer" && childValue !== "" && childValue != null && !Number.isInteger(Number(childValue))) return `Row ${rowIndex + 1}: enter a whole number for ${child.label.en || child.label.ar}.`
        if (child.type === "decimal" && childValue !== "" && childValue != null && !Number.isFinite(Number(childValue))) return `Row ${rowIndex + 1}: enter a number for ${child.label.en || child.label.ar}.`
      }
    }
  }
  if (question.type === "attestation" && value !== true) return "Acknowledgment is required."
  if (question.type === "boolean" && typeof value !== "boolean") return "Choose yes or no."
  if (question.validation.maxLength && String(value).length > question.validation.maxLength) return `Maximum length is ${question.validation.maxLength}.`
}

function conditionMatches(rule: Condition, answer: unknown, sourceType?: FieldType): boolean {
  const comparable = (value: unknown): number => {
    if (sourceType === "time") { const [hours, minutes] = String(value).split(":").map(Number); return hours * 60 + minutes }
    if (sourceType === "date" || sourceType === "datetime") return Date.parse(String(value))
    return Number(value)
  }
  switch (rule.operator) {
    case "equals": return Array.isArray(answer) ? answer.includes(rule.value) : answer === rule.value
    case "not_equals": return Array.isArray(answer) ? !answer.includes(rule.value) : answer !== rule.value
    case "contains": return Array.isArray(answer) ? answer.includes(rule.value) : typeof answer === "string" && answer.includes(String(rule.value))
    case "greater_than": return comparable(answer) > comparable(rule.value)
    case "less_than": return comparable(answer) < comparable(rule.value)
    case "is_empty": return answer == null || answer === "" || Array.isArray(answer) && answer.length === 0
    case "is_not_empty": return !(answer == null || answer === "" || Array.isArray(answer) && answer.length === 0)
    default: return false
  }
}
export type QuestionRuntimeState = { visible: boolean; required: boolean; evidenceRequired: boolean }
export function getQuestionRuntimeStates(form: FormDefinition, answers: Record<string, unknown>): Record<string, QuestionRuntimeState> {
  const states: Record<string, QuestionRuntimeState> = Object.fromEntries(form.questions.map((question) => [question.id, { visible: true, required: question.required, evidenceRequired: false }]))
  for (const target of form.questions) {
    const rules = form.questions.flatMap((owner) => owner.conditions).filter((rule) => rule.targetQuestionId === target.id)
    const matching = rules.filter((rule) => { const source = form.questions.find((question) => question.id === rule.sourceQuestionId); return source ? conditionMatches(rule, answers[source.id], source.type) : false })
    const showRules = rules.filter((rule) => rule.effect === "show")
    states[target.id].visible = (!showRules.length || matching.some((rule) => rule.effect === "show")) && !matching.some((rule) => rule.effect === "hide")
    states[target.id].required = target.required || matching.some((rule) => rule.effect === "require")
    states[target.id].evidenceRequired = matching.some((rule) => rule.effect === "require_evidence")
  }
  return states
}
export function evaluateConditions(form: FormDefinition, answers: Record<string, unknown>): Set<string> {
  return new Set(Object.entries(getQuestionRuntimeStates(form, answers)).filter(([, state]) => state.visible).map(([id]) => id))
}

export function calculateLocalScore(form: FormDefinition, answers: Record<string, unknown>): { score: number | null; earned: number; possible: number; answered: number } {
  let earned = 0, possible = 0, answered = 0
  for (const question of form.questions) {
    if (!question.scoring.included || question.type === "instruction" || question.type === "repeat_group" || question.type === "calculated") continue
    const answer = answers[question.id]
    const empty = answer == null || answer === "" || Array.isArray(answer) && answer.length === 0
    if (empty && question.scoring.denominator === "answered") continue
    if (!empty) answered++
    const weight = question.scoring.weight
    let fraction = 0
    let supported = false
    if (question.type === "boolean") { supported = true; fraction = answer === (question.scoring.passValue ?? question.config.passValue ?? true) ? 1 : 0 }
    if (question.type === "single_select" || question.type === "multi_select") {
      const choices = question.config.choices ?? []
      const scores = choices.map((choice) => choice.score).filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      if (scores.length) {
        supported = true
        const selected = new Set(Array.isArray(answer) ? answer : [answer])
        const selectedScore = choices.filter((choice) => selected.has(choice.id)).reduce((sum, choice) => sum + (choice.score ?? 0), 0)
        fraction = Math.max(0, Math.min(1, selectedScore / Math.max(...scores) / (question.type === "multi_select" ? Math.max(1, selected.size) : 1)))
      }
    }
    if (!supported && question.scoring.passValue !== undefined) { supported = true; fraction = answer === question.scoring.passValue ? 1 : 0 }
    if (!supported) continue
    possible += weight
    if (!empty) earned += weight * fraction
  }
  return { score: possible > 0 ? Math.round((earned / possible) * 10000) / 100 : null, earned, possible, answered }
}

export function roundCalculated(value: number, precision: number, method: "half_up" | "half_even" | "truncate" = "half_up"): number {
  const factor = 10 ** precision
  const scaled = Math.abs(value) * factor
  const lower = Math.floor(scaled)
  const fraction = scaled - lower
  const epsilon = Number.EPSILON * Math.max(1, scaled) * 4
  const rounded = method === "truncate" ? lower : fraction > 0.5 + epsilon ? lower + 1 : fraction < 0.5 - epsilon ? lower : method === "half_even" ? lower % 2 === 0 ? lower : lower + 1 : lower + 1
  return Math.sign(value) * rounded / factor
}

export function evaluateFormula(expression: string, answers: Record<string, unknown>, questions: Question[]): number {
  const tokens: (number | string)[] = []
  const pattern = /\{\{([^{}]+)\}\}|(?:\d+(?:\.\d*)?|\.\d+)|[()+*/-]/gy
  let cursor = 0
  while (cursor < expression.length) {
    if (/\s/.test(expression[cursor])) { cursor++; continue }
    pattern.lastIndex = cursor
    const match = pattern.exec(expression)
    if (!match) throw new Error("Formula contains an unsupported token.")
    cursor = pattern.lastIndex
    if (match[1]) {
      const question = questions.find((item) => item.id === match[1])
      if (!question) throw new Error(`Unknown question reference: ${match[1]}.`)
      if (question.type !== "integer" && question.type !== "decimal" && question.type !== "calculated") throw new Error("Formula references must be numeric questions.")
      const answer = Number(answers[question.id])
      if (!Number.isFinite(answer)) throw new Error(`Numeric answer missing for ${question.id}.`)
      tokens.push(answer)
    } else if (/^(?:\d|\.)/.test(match[0])) tokens.push(Number(match[0]))
    else tokens.push(match[0])
  }
  let index = 0
  const primary = (): number => {
    const token = tokens[index++]
    if (token === "+") return primary()
    if (token === "-") return -primary()
    if (token === "(") { const result = sum(); if (tokens[index++] !== ")") throw new Error("Formula parentheses do not match."); return result }
    if (typeof token === "number") return token
    throw new Error("Formula is incomplete or invalid.")
  }
  const product = (): number => { let value = primary(); while (tokens[index] === "*" || tokens[index] === "/") { const op = tokens[index++]; const next = primary(); if (op === "/" && next === 0) throw new Error("Formula divides by zero."); value = op === "*" ? value * next : value / next }; return value }
  const sum = (): number => { let value = product(); while (tokens[index] === "+" || tokens[index] === "-") { const op = tokens[index++]; const next = product(); value = op === "+" ? value + next : value - next }; return value }
  const result = sum()
  if (index !== tokens.length || !Number.isFinite(result)) throw new Error("Formula is invalid or produced a non-finite result.")
  return result
}
