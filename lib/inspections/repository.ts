import mockData from "../../data/mock-data.json" with { type: "json" }
import { newId } from "../forms/domain.ts"

export type InspectionStatus = "draft" | "submitted" | "in_review" | "approved" | "returned" | "scheduled" | "in_progress" | "cancelled"
export type InspectionStage = "reviewer_1" | "reviewer_2" | "final_reviewer" | null
export type InspectionAnswer = { questionId: string; value: unknown }
export type ReviewEntry = { id: string; stage: string; decision: "approved" | "returned"; actorId: string; at: string; reason?: string; revision: number }
export type InspectionRecord = { id: string; workspaceId: string; siteId: string; templateId: string; templateVersion: number; title: string; inspectorId: string; status: InspectionStatus; currentStage: InspectionStage; answers: InspectionAnswer[]; revision: number; createdAt: string; submittedAt?: string; updatedAt: string; reviewHistory: ReviewEntry[]; dueAt?: string; findings?: InspectionFinding[] }
export type InspectionFinding = { id: string; questionId: string; title: string; description: string; priority: "low" | "medium" | "high"; photoName?: string }
export type InspectionDraftInput = Pick<InspectionRecord, "workspaceId" | "siteId" | "templateId" | "templateVersion" | "title" | "inspectorId"> & { dueAt?: string }
export type ReviewDecision = { decision: "approved" | "returned"; actorId: string; reason?: string; expectedRevision: number }
export interface InspectionRepository { list(workspaceId?: string): InspectionRecord[]; get(id: string): InspectionRecord | undefined; create(input: InspectionDraftInput): InspectionRecord; saveDraft(id: string, answers: InspectionAnswer[], expectedRevision: number, findings?: InspectionFinding[]): InspectionRecord; submit(id: string, answers: InspectionAnswer[], expectedRevision: number, findings?: InspectionFinding[]): InspectionRecord; review(id: string, decision: ReviewDecision): InspectionRecord }
export class RevisionConflictError extends Error { constructor() { super("This inspection was changed by someone else."); this.name = "RevisionConflictError" } }
export class LocalInspectionRepository implements InspectionRepository {
  private readonly key = "sentriq.inspections.repository.v1"
  private read(): InspectionRecord[] {
    if (typeof localStorage === "undefined") return structuredClone(mockData.inspections as InspectionRecord[])
    try {
      const raw = localStorage.getItem(this.key)
      if (!raw) return structuredClone(mockData.inspections as InspectionRecord[])
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) throw new Error("Invalid inspection data")
      return parsed as InspectionRecord[]
    } catch { throw new Error("Saved inspection data could not be read. It has not been overwritten.") }
  }
  private write(records: InspectionRecord[]) { try { if (typeof localStorage !== "undefined") localStorage.setItem(this.key, JSON.stringify(records)) } catch { throw new Error("Your changes could not be saved in this browser. Check available storage and try again.") } }
  list(workspaceId?: string) { return structuredClone(this.read().filter((record) => !workspaceId || record.workspaceId === workspaceId)) }
  get(id: string) { return structuredClone(this.read().find((record) => record.id === id)) }
  private update(id: string, expectedRevision: number, mutate: (record: InspectionRecord) => void) {
    const records = this.read(); const record = records.find((item) => item.id === id)
    if (!record) throw new Error("Inspection not found.")
    if (record.revision !== expectedRevision) throw new RevisionConflictError()
    mutate(record); record.revision += 1; record.updatedAt = new Date().toISOString(); this.write(records); return structuredClone(record)
  }
  create(input: InspectionDraftInput) {
    const records = this.read(); const now = new Date().toISOString()
    const record: InspectionRecord = { ...input, id: `INS-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`, status: "draft", currentStage: null, answers: [], revision: 1, createdAt: now, updatedAt: now, reviewHistory: [], findings: [] }
    records.unshift(record); this.write(records); return structuredClone(record)
  }
  saveDraft(id: string, answers: InspectionAnswer[], expectedRevision: number, findings: InspectionFinding[] = []) { return this.update(id, expectedRevision, (record) => { if (!["draft", "in_progress", "returned"].includes(record.status)) throw new Error("Only a draft or returned inspection can be edited."); record.answers = structuredClone(answers); record.findings = structuredClone(findings); if (record.status === "returned") record.status = "draft"; else record.status = "in_progress" }) }
  submit(id: string, answers: InspectionAnswer[], expectedRevision: number, findings: InspectionFinding[] = []) { return this.update(id, expectedRevision, (record) => { if (!["draft", "in_progress", "returned"].includes(record.status)) throw new Error("This inspection cannot be submitted in its current status."); record.answers = structuredClone(answers); record.findings = structuredClone(findings); record.status = "submitted"; record.currentStage = "reviewer_1"; record.submittedAt = new Date().toISOString() }) }
  review(id: string, decision: ReviewDecision) { return this.update(id, decision.expectedRevision, (record) => { if (!["submitted", "in_review"].includes(record.status)) throw new Error("This inspection is not waiting for review."); if (decision.decision === "returned" && !decision.reason?.trim()) throw new Error("A reason is required when returning an inspection."); record.reviewHistory.push({ id: newId("review"), stage: record.currentStage ?? "reviewer_1", decision: decision.decision, actorId: decision.actorId, at: new Date().toISOString(), reason: decision.reason?.trim(), revision: record.revision + 1 }); record.status = decision.decision === "returned" ? "returned" : "approved"; record.currentStage = decision.decision === "approved" ? "final_reviewer" : record.currentStage }) }
}
export function isOverdue(record: Pick<InspectionRecord, "status" | "dueAt">, now = new Date()) { return Boolean(record.dueAt && new Date(record.dueAt).getTime() < now.getTime() && !["submitted", "in_review", "approved", "cancelled"].includes(record.status)) }
export const inspectionRepository = new LocalInspectionRepository()
