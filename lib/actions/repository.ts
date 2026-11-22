import mockData from "../../data/mock-data.json" with { type: "json" }
import { newId } from "../forms/domain.ts"

export type ActionStatus = "open" | "in_progress" | "closure_requested" | "closed"
export type ActionPriority = "low" | "medium" | "high" | "critical"
export type ActionUpdate = { id: string; at: string; actorId: string; from: ActionStatus | null; to: ActionStatus; note?: string }
export type ActionRecord = {
  id: string
  workspaceId: string
  siteId: string
  findingId: string
  inspectionId: string
  title: string
  description: string
  ownerId: string
  priority: ActionPriority
  status: ActionStatus
  responseDueAt?: string
  planDueAt?: string
  closureDueAt?: string
  updates: ActionUpdate[]
  followUps?: unknown[]
  evidenceIds: string[]
  /** Names of files attached in this browser (demo only, never uploaded). */
  evidenceNames?: string[]
  revision: number
  createdAt?: string
  updatedAt?: string
}
export type ActionDraftInput = Pick<ActionRecord, "workspaceId" | "siteId" | "findingId" | "inspectionId" | "title" | "ownerId" | "priority"> & { description?: string; closureDueAt?: string; responseDueAt?: string; createdBy?: string }
export type ActionTransition = {
  to: ActionStatus
  actorId: string
  /** Derived from the demo permission map (actions.verify). Server-side enforcement replaces this later. */
  canVerify: boolean
  expectedRevision: number
  reason?: string
}

export const MIN_ACTION_REASON = 5

export type ActionErrorCode = "STALE_REVISION" | "NOT_FOUND" | "INVALID_TRANSITION" | "REASON_REQUIRED" | "NOT_OWNER" | "NOT_VERIFIER" | "SELF_VERIFY" | "STORAGE_UNREADABLE" | "STORAGE_FAILED"
const messages: Record<ActionErrorCode, string> = {
  STALE_REVISION: "This action was changed by someone else.",
  NOT_FOUND: "Action not found.",
  INVALID_TRANSITION: "This status change is not allowed.",
  REASON_REQUIRED: `A reason is required when returning an action (at least ${MIN_ACTION_REASON} characters).`,
  NOT_OWNER: "Only the action owner can do this.",
  NOT_VERIFIER: "Only a verifier can close or return an action.",
  SELF_VERIFY: "The action owner cannot verify their own action.",
  STORAGE_UNREADABLE: "Saved action data could not be read. It has not been overwritten.",
  STORAGE_FAILED: "Your changes could not be saved in this browser.",
}
export class ActionError extends Error {
  readonly code: ActionErrorCode
  constructor(code: ActionErrorCode) { super(messages[code]); this.name = "ActionError"; this.code = code }
}

const ALLOWED: Record<ActionStatus, ActionStatus[]> = {
  open: ["in_progress"],
  in_progress: ["closure_requested"],
  closure_requested: ["closed", "in_progress"],
  closed: [],
}

export interface ActionRepository {
  list(workspaceId?: string): ActionRecord[]
  get(id: string): ActionRecord | undefined
  listForInspection(inspectionId: string): ActionRecord[]
  create(input: ActionDraftInput): ActionRecord
  transition(id: string, change: ActionTransition): ActionRecord
  attachEvidence(id: string, names: string[], expectedRevision: number): ActionRecord
}

export class LocalActionRepository implements ActionRepository {
  private readonly key = "sentriq.actions.repository.v1"

  private seed(): ActionRecord[] {
    return structuredClone(mockData.actions as unknown as ActionRecord[]).map((item) => ({ ...item, updates: item.updates ?? [], evidenceIds: item.evidenceIds ?? [], evidenceNames: [] }))
  }
  private read(): ActionRecord[] {
    if (typeof localStorage === "undefined") return this.seed()
    try {
      const raw = localStorage.getItem(this.key)
      if (!raw) return this.seed()
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) throw new Error("Invalid action data")
      return parsed as ActionRecord[]
    } catch { throw new ActionError("STORAGE_UNREADABLE") }
  }
  private write(records: ActionRecord[]) {
    try { if (typeof localStorage !== "undefined") localStorage.setItem(this.key, JSON.stringify(records)) } catch { throw new ActionError("STORAGE_FAILED") }
  }

  list(workspaceId?: string) { return structuredClone(this.read().filter((record) => !workspaceId || record.workspaceId === workspaceId)) }
  get(id: string) { return structuredClone(this.read().find((record) => record.id === id)) }
  listForInspection(inspectionId: string) { return structuredClone(this.read().filter((record) => record.inspectionId === inspectionId)) }

  private update(id: string, expectedRevision: number, mutate: (record: ActionRecord) => void) {
    const records = this.read()
    const record = records.find((item) => item.id === id)
    if (!record) throw new ActionError("NOT_FOUND")
    if (record.revision !== expectedRevision) throw new ActionError("STALE_REVISION")
    mutate(record)
    record.revision += 1
    record.updatedAt = new Date().toISOString()
    this.write(records)
    return structuredClone(record)
  }

  create(input: ActionDraftInput) {
    const records = this.read()
    const now = new Date().toISOString()
    const record: ActionRecord = {
      id: `ACT-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
      workspaceId: input.workspaceId, siteId: input.siteId, findingId: input.findingId, inspectionId: input.inspectionId,
      title: input.title.trim(), description: input.description?.trim() ?? "", ownerId: input.ownerId, priority: input.priority,
      status: "open", responseDueAt: input.responseDueAt, closureDueAt: input.closureDueAt,
      updates: [{ id: newId("update"), at: now, actorId: input.createdBy ?? input.ownerId, from: null, to: "open", note: "Action created" }],
      evidenceIds: [], evidenceNames: [], revision: 1, createdAt: now, updatedAt: now,
    }
    records.unshift(record)
    this.write(records)
    return structuredClone(record)
  }

  transition(id: string, change: ActionTransition) {
    return this.update(id, change.expectedRevision, (record) => {
      if (!ALLOWED[record.status].includes(change.to)) throw new ActionError("INVALID_TRANSITION")
      const fromVerifier = record.status === "closure_requested"
      if (fromVerifier) {
        if (!change.canVerify) throw new ActionError("NOT_VERIFIER")
        if (change.actorId === record.ownerId) throw new ActionError("SELF_VERIFY")
        if (change.to === "in_progress" && (change.reason?.trim().length ?? 0) < MIN_ACTION_REASON) throw new ActionError("REASON_REQUIRED")
      } else if (change.actorId !== record.ownerId) throw new ActionError("NOT_OWNER")
      record.updates.push({ id: newId("update"), at: new Date().toISOString(), actorId: change.actorId, from: record.status, to: change.to, note: change.reason?.trim() || undefined })
      record.status = change.to
    })
  }

  attachEvidence(id: string, names: string[], expectedRevision: number) {
    return this.update(id, expectedRevision, (record) => { record.evidenceNames = [...(record.evidenceNames ?? []), ...names] })
  }
}

export function isActionOverdue(record: Pick<ActionRecord, "status" | "closureDueAt">, now = new Date()) {
  return Boolean(record.closureDueAt && record.status !== "closed" && new Date(record.closureDueAt).getTime() < now.getTime())
}
export function daysOverdue(record: Pick<ActionRecord, "status" | "closureDueAt">, now = new Date()) {
  if (!isActionOverdue(record, now)) return 0
  return Math.max(1, Math.floor((now.getTime() - new Date(record.closureDueAt as string).getTime()) / 86_400_000))
}

export const actionRepository = new LocalActionRepository()
