import { charCount, returnPath } from "./policy.ts"
import mockData from "../../data/mock-data.json" with { type: "json" }
import { newId } from "../forms/domain.ts"

export type InspectionStatus = "draft" | "submitted" | "in_review" | "approved" | "returned" | "scheduled" | "in_progress" | "cancelled"
export type InspectionStage = "reviewer_1" | "reviewer_2" | "final_reviewer" | null
export type ReviewStageId = Exclude<InspectionStage, null>
export type InspectionAnswer = { questionId: string; value: unknown }
export type ReviewEntry = { id: string; stage: string; decision: "approved" | "returned" | "reopened"; actorId: string; at: string; reason?: string; revision: number; cycle?: number; flaggedQuestionIds?: string[]; answersAtReturn?: InspectionAnswer[]; notified?: string[] }
export type SubmissionEvent = { id: string; at: string; cycle: number; kind: "submitted" | "resubmitted" | "resubmitted_without_change"; changedQuestionIds: string[]; path?: "resume" | "restart"; stage?: string; reply?: string; droppedHidden?: { questionId: string; ruleIds: string[]; reason: string }[] }
export type SubmitMeta = { reply?: string; droppedHidden?: { questionId: string; ruleIds: string[]; reason: string }[] }
export type InspectionFinding = {
  id: string
  questionId: string
  title: string
  description: string
  priority: "low" | "medium" | "high"
  photoName?: string
}
export type InspectionRecord = {
  id: string
  workspaceId: string
  siteId: string
  templateId: string
  templateVersion: number
  title: string
  inspectorId: string
  status: InspectionStatus
  currentStage: InspectionStage
  answers: InspectionAnswer[]
  revision: number
  createdAt: string
  submittedAt?: string
  updatedAt: string
  reviewHistory: ReviewEntry[]
  dueAt?: string
  findings?: InspectionFinding[]
  /** Increments on every submission. A returned inspection restarts review at the first stage. */
  cycle?: number
  /** Optional per-template override of the review chain. */
  reviewStages?: ReviewStageId[]
  /** client submission id -> payload fingerprint. The same id with the same payload returns the same record. */
  submissionKeys?: Record<string, string>
  /** Append-only. Each resubmission records which answers changed and where review resumed (preview of the server rule). */
  submissionHistory?: SubmissionEvent[]
}
export type InspectionDraftInput = Pick<InspectionRecord, "workspaceId" | "siteId" | "templateId" | "templateVersion" | "title" | "inspectorId"> & { dueAt?: string; reviewStages?: ReviewStageId[] }
export type ReviewDecision = {
  decision: "approved" | "returned"
  actorId: string
  reason?: string
  /** Questions the reviewer marked on a return. A marker only. It creates nothing else. */
  flaggedQuestionIds?: string[]
  expectedRevision: number
  /** The stage the actor is allowed to act on. When provided it must match the inspection's current stage. */
  stage?: ReviewStageId
}

export const DEFAULT_REVIEW_STAGES: ReviewStageId[] = ["reviewer_1", "reviewer_2", "final_reviewer"]
export const MIN_RETURN_REASON = 5
/** Written reply when an inspector resubmits a returned inspection without changing any answer. */
export const MIN_UNCHANGED_REPLY = 10

export type InspectionErrorCode =
  | "STALE_REVISION"
  | "CLIENT_ID_PAYLOAD_MISMATCH"
  | "NOT_FOUND"
  | "NOT_EDITABLE"
  | "NOT_WAITING_FOR_REVIEW"
  | "REASON_REQUIRED"
  | "WRONG_STAGE"
  | "SELF_REVIEW"
  | "ALREADY_REVIEWED"
  | "REPLY_REQUIRED"
  | "REOPEN_NOT_APPROVED"
  | "REOPEN_LOCKED"
  | "STORAGE_UNREADABLE"
  | "STORAGE_FAILED"

const messages: Record<InspectionErrorCode, string> = {
  STALE_REVISION: "This inspection was changed by someone else.",
  CLIENT_ID_PAYLOAD_MISMATCH: "This submission id was already used with different answers. Nothing was changed.",
  NOT_FOUND: "Inspection not found.",
  NOT_EDITABLE: "Only a draft or returned inspection can be edited.",
  NOT_WAITING_FOR_REVIEW: "This inspection is not waiting for review.",
  REASON_REQUIRED: `A reason is required when returning an inspection (at least ${MIN_RETURN_REASON} characters).`,
  WRONG_STAGE: "This inspection is waiting for a different review stage.",
  SELF_REVIEW: "You cannot review an inspection that you carried out.",
  ALREADY_REVIEWED: "You already approved an earlier stage of this inspection.",
  REOPEN_NOT_APPROVED: "Only an approved inspection can be reopened.",
  REOPEN_LOCKED: "This inspection is locked. The reopen period has ended.",
  REPLY_REQUIRED: `Nothing was changed after the return. Write why, at least ${MIN_UNCHANGED_REPLY} characters.`,
  STORAGE_UNREADABLE: "Saved inspection data could not be read. It has not been overwritten.",
  STORAGE_FAILED: "Your changes could not be saved in this browser. Check available storage and try again.",
}

export class InspectionError extends Error {
  readonly code: InspectionErrorCode
  constructor(code: InspectionErrorCode) {
    super(messages[code])
    this.name = "InspectionError"
    this.code = code
  }
}
export class RevisionConflictError extends InspectionError {
  constructor() {
    super("STALE_REVISION")
    this.name = "RevisionConflictError"
  }
}

export interface InspectionRepository {
  list(workspaceId?: string): InspectionRecord[]
  get(id: string): InspectionRecord | undefined
  create(input: InspectionDraftInput): InspectionRecord
  saveDraft(id: string, answers: InspectionAnswer[], expectedRevision: number, findings?: InspectionFinding[]): InspectionRecord
  submit(id: string, answers: InspectionAnswer[], expectedRevision: number, findings?: InspectionFinding[], clientId?: string, meta?: SubmitMeta): InspectionRecord
  review(id: string, decision: ReviewDecision): InspectionRecord
}

/** Stable fingerprint of what is being submitted (key order does not matter). Local stand-in: the server must use SHA-256 of the canonical answers. */
export function payloadFingerprint(answers: InspectionAnswer[], findings: InspectionFinding[] = []): string {
  const text = JSON.stringify([[...answers].sort((a, b) => a.questionId.localeCompare(b.questionId)).map((a) => [a.questionId, a.value]), findings.map((f) => [f.questionId, f.title, f.description, f.priority])])
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619) >>> 0 }
  return `${text.length}:${hash.toString(16)}`
}

const EDITABLE: InspectionStatus[] = ["draft", "in_progress", "returned"]

export function reviewStagesOf(record: Pick<InspectionRecord, "reviewStages">): ReviewStageId[] {
  return record.reviewStages?.length ? record.reviewStages : DEFAULT_REVIEW_STAGES
}

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
    } catch {
      throw new InspectionError("STORAGE_UNREADABLE")
    }
  }

  private write(records: InspectionRecord[]) {
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(this.key, JSON.stringify(records))
    } catch {
      throw new InspectionError("STORAGE_FAILED")
    }
  }

  list(workspaceId?: string) {
    return structuredClone(this.read().filter((record) => !workspaceId || record.workspaceId === workspaceId))
  }

  get(id: string) {
    return structuredClone(this.read().find((record) => record.id === id))
  }

  private update(id: string, expectedRevision: number, mutate: (record: InspectionRecord) => void) {
    const records = this.read()
    const record = records.find((item) => item.id === id)
    if (!record) throw new InspectionError("NOT_FOUND")
    if (record.revision !== expectedRevision) throw new RevisionConflictError()
    mutate(record)
    record.revision += 1
    record.updatedAt = new Date().toISOString()
    this.write(records)
    return structuredClone(record)
  }

  create(input: InspectionDraftInput) {
    const records = this.read()
    const now = new Date().toISOString()
    const record: InspectionRecord = {
      ...input,
      id: `INS-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
      status: "draft",
      currentStage: null,
      answers: [],
      revision: 1,
      createdAt: now,
      updatedAt: now,
      reviewHistory: [],
      findings: [],
      cycle: 0,
    }
    records.unshift(record)
    this.write(records)
    return structuredClone(record)
  }

  saveDraft(id: string, answers: InspectionAnswer[], expectedRevision: number, findings: InspectionFinding[] = []) {
    return this.update(id, expectedRevision, (record) => {
      if (!EDITABLE.includes(record.status)) throw new InspectionError("NOT_EDITABLE")
      record.answers = structuredClone(answers)
      record.findings = structuredClone(findings)
      record.status = record.status === "returned" ? "draft" : "in_progress"
    })
  }

  submit(id: string, answers: InspectionAnswer[], expectedRevision: number, findings: InspectionFinding[] = [], clientId?: string, meta: SubmitMeta = {}) {
    const fingerprint = payloadFingerprint(answers, findings)
    if (clientId) {
      const known = this.get(id)?.submissionKeys?.[clientId]
      if (known !== undefined) { if (known !== fingerprint) throw new InspectionError("CLIENT_ID_PAYLOAD_MISMATCH"); return this.get(id) as InspectionRecord }
    }
    return this.update(id, expectedRevision, (record) => {
      if (!EDITABLE.includes(record.status)) throw new InspectionError("NOT_EDITABLE")
      if (clientId) record.submissionKeys = { ...(record.submissionKeys ?? {}), [clientId]: fingerprint }
      record.answers = structuredClone(answers)
      record.findings = structuredClone(findings)
      const stages = reviewStagesOf(record)
      const lastReturn = [...record.reviewHistory].reverse().find((entry) => entry.decision === "returned" || entry.decision === "reopened")
      const resubmission = lastReturn && (lastReturn.cycle ?? 0) === (record.cycle ?? 0) // a draft save keeps the return open
      const decided = resubmission ? returnPath({ returnedStage: lastReturn.stage, firstStage: stages[0], flaggedQuestionIds: lastReturn.flaggedQuestionIds ?? [], returned: lastReturn.answersAtReturn ?? record.answers, resubmitted: answers }) : undefined
      const unchanged = !!decided && decided.changedQuestionIds.length === 0
      const reply = meta.reply?.trim()
      if (unchanged && charCount(reply) < MIN_UNCHANGED_REPLY) throw new InspectionError("REPLY_REQUIRED")
      record.submissionHistory = [...(record.submissionHistory ?? []), { id: newId("sub"), at: new Date().toISOString(), cycle: (record.cycle ?? 0) + 1, kind: decided ? (unchanged ? "resubmitted_without_change" : "resubmitted") : "submitted", changedQuestionIds: decided?.changedQuestionIds ?? [], path: decided?.path, stage: decided?.stage, ...(unchanged ? { reply } : {}), ...(meta.droppedHidden?.length ? { droppedHidden: meta.droppedHidden } : {}) }]
      record.status = "submitted"
      record.currentStage = (decided?.stage as InspectionStage | undefined) ?? stages[0]
      record.submittedAt = new Date().toISOString()
      record.cycle = (record.cycle ?? 0) + 1
    })
  }

  /** Reopen an APPROVED inspection. A separate privileged action: reason required, the approval stays in history, nothing is edited in place.
   *  The record goes back to the inspector as a new revision and re-enters the chain by the same return-path rule. `notified` lists who approved earlier (the server sends the notices). */
  reopen(id: string, input: { actorId: string; reason: string; expectedRevision: number; lockAfterDays?: number }) {
    return this.update(id, input.expectedRevision, (record) => {
      if (record.status !== "approved") throw new InspectionError("REOPEN_NOT_APPROVED")
      const reason = input.reason?.trim()
      if (!reason || reason.length < MIN_RETURN_REASON) throw new InspectionError("REASON_REQUIRED")
      const cycle = record.cycle ?? 0
      const approvals = record.reviewHistory.filter((entry) => entry.decision === "approved" && (entry.cycle ?? 0) === cycle)
      const lastApproval = approvals[approvals.length - 1]
      if (input.lockAfterDays !== undefined && lastApproval && Date.now() - Date.parse(lastApproval.at) > input.lockAfterDays * 86_400_000) throw new InspectionError("REOPEN_LOCKED")
      const stages = reviewStagesOf(record)
      record.reviewHistory.push({ id: newId("review"), stage: stages[stages.length - 1], decision: "reopened", actorId: input.actorId, at: new Date().toISOString(), reason, revision: record.revision + 1, cycle, flaggedQuestionIds: [], answersAtReturn: structuredClone(record.answers), notified: [...new Set(approvals.map((entry) => entry.actorId))] })
      record.status = "returned"
      record.currentStage = null
    })
  }

  review(id: string, decision: ReviewDecision) {
    return this.update(id, decision.expectedRevision, (record) => {
      if (!["submitted", "in_review"].includes(record.status) || !record.currentStage) throw new InspectionError("NOT_WAITING_FOR_REVIEW")
      const stage = record.currentStage
      if (decision.stage && decision.stage !== stage) throw new InspectionError("WRONG_STAGE")
      if (decision.actorId === record.inspectorId) throw new InspectionError("SELF_REVIEW")
      const reason = decision.reason?.trim()
      if (decision.decision === "returned" && (!reason || reason.length < MIN_RETURN_REASON)) throw new InspectionError("REASON_REQUIRED")
      const cycle = record.cycle ?? 0
      const approvedEarlier = record.reviewHistory.some((entry) => (entry.cycle ?? 0) === cycle && entry.decision === "approved" && entry.actorId === decision.actorId)
      if (decision.decision === "approved" && approvedEarlier) throw new InspectionError("ALREADY_REVIEWED")

      record.reviewHistory.push({ id: newId("review"), stage, decision: decision.decision, actorId: decision.actorId, at: new Date().toISOString(), reason, revision: record.revision + 1, cycle, ...(decision.decision === "returned" ? { flaggedQuestionIds: [...(decision.flaggedQuestionIds ?? [])], answersAtReturn: structuredClone(record.answers) } : {}) })

      if (decision.decision === "returned") {
        record.status = "returned"
        record.currentStage = null
        return
      }
      const stages = reviewStagesOf(record)
      const next = stages[stages.indexOf(stage) + 1]
      if (next) {
        record.status = "in_review"
        record.currentStage = next
      } else {
        record.status = "approved"
        record.currentStage = null
      }
    })
  }
}

export function isOverdue(record: Pick<InspectionRecord, "status" | "dueAt">, now = new Date()) {
  return Boolean(record.dueAt && new Date(record.dueAt).getTime() < now.getTime() && !["submitted", "in_review", "approved", "cancelled"].includes(record.status))
}

export const inspectionRepository = new LocalInspectionRepository()
