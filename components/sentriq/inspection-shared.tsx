import { createQuestion, emptyForm, type FormDefinition, type Question } from "@/lib/forms/domain"
import { formRepository } from "@/lib/forms/repository"
import mockData from "@/data/mock-data.json"
import { demoActor, can, hasCompanyAccess } from "@/lib/sentriq/demo-permissions"
import type { InspectionAnswer, InspectionRecord } from "@/lib/inspections/repository"
import type { Language } from "@/lib/sentriq/format"

export type Template = { id: string; title: { en: string; ar: string }; version: number; snapshot: FormDefinition }

export const siteRows = mockData.workspaces.flatMap((workspace) => workspace.sites.map((site) => ({ ...site, workspaceId: workspace.id })))
export const people = mockData.users

const localizedTemplate = (form: FormDefinition): Template => ({
  id: form.id,
  title: form.title,
  version: Math.max(1, ...form.publishedVersions.map((item) => item.version)),
  snapshot: (form.publishedVersions.at(-1)?.snapshot ?? form) as FormDefinition,
})

/** Published forms from the local form library plus the seeded demo forms that have questions. */
export function getTemplates(): Template[] {
  const local = formRepository.list()
    .filter((form) => form.status === "Published" && form.publishedVersions.length && form.questions.some((question) => question.type !== "instruction"))
    .map(localizedTemplate)
  const seeded = mockData.forms
    .filter((form) => form.status === "published" && form.sections.some((section) => section.questions.length > 0))
    .map((source) => {
      const form = emptyForm()
      form.id = source.id; form.title = source.title; form.status = "Published"; form.category = source.category
      form.sections = source.sections.map((section) => ({ id: section.id, title: section.title, description: { en: "", ar: "" }, questionIds: [] }))
      for (const section of source.sections) for (const sourceQuestion of section.questions) {
        const kind = sourceQuestion.type === "yes_no" ? "boolean" : sourceQuestion.type === "evidence" ? "photo" : sourceQuestion.type === "single_select" ? "single_select" : sourceQuestion.type === "long_text" ? "long_text" : "short_text"
        const question = createQuestion(kind, section.id)
        question.id = sourceQuestion.id; question.title = sourceQuestion.title; question.required = sourceQuestion.required
        if (kind === "single_select" && "options" in sourceQuestion) question.config.choices = sourceQuestion.options.map((option: { value: string; label: { en: string; ar: string } }) => ({ id: option.value, label: option.label, score: null, finding: false }))
        form.questions.push(question)
        form.sections.find((item) => item.id === section.id)?.questionIds.push(question.id)
      }
      form.publishedVersions = [{ id: `${form.id}-v${source.currentVersion}`, version: source.currentVersion, publishedAt: source.updatedAt, snapshot: { ...form, status: "Published" } }]
      return localizedTemplate(form)
    })
  return [...local, ...seeded.filter((item) => !local.some((form) => form.id === item.id))]
}

export const questionLabel = (question: Question, language: Language) => question.title[language] || question.title.en

export function answersToRows(answers: Record<string, unknown>): InspectionAnswer[] {
  return Object.entries(answers).map(([questionId, value]) => ({
    questionId,
    value: Array.isArray(value) && value.length && value.every((item) => typeof File !== "undefined" && item instanceof File) ? value.map((file: File) => file.name) : value,
  }))
}

export function isAnswered(value: unknown) {
  if (value === undefined || value === null || value === "") return false
  if (Array.isArray(value)) return value.length > 0
  return true
}

export function siteName(siteId: string) { return siteRows.find((site) => site.id === siteId)?.name ?? "—" }
export function personName(userId: string) { return people.find((person) => person.id === userId)?.displayName ?? "—" }

/** Who the current demo role is, and which sites it can see. Demo only, never real access control. */
export function accessFor(role: string) {
  const actor = demoActor(role)
  const siteIds = hasCompanyAccess(role) ? people.find((person) => person.id === actor.userId)?.siteIds ?? [] : []
  return { actor, siteIds, canRead: hasCompanyAccess(role), canCreate: can(role, "inspections.create"), canExecute: can(role, "inspections.execute") }
}

export function mayExecute(role: string, record: Pick<InspectionRecord, "inspectorId" | "status">) {
  const access = accessFor(role)
  return access.canExecute && record.inspectorId === access.actor.userId && ["draft", "in_progress", "returned"].includes(record.status)
}
