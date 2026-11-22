import test from "node:test"
import assert from "node:assert/strict"
import { InspectionError, LocalInspectionRepository, RevisionConflictError, isOverdue, type InspectionRecord } from "./repository.ts"

function withStorage(run: (repository: LocalInspectionRepository) => void) {
  const stored = new Map<string, string>()
  const previous = globalThis.localStorage
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => { stored.set(key, value) } } as Storage })
  try { run(new LocalInspectionRepository()) } finally { Object.defineProperty(globalThis, "localStorage", { configurable: true, value: previous }) }
}
const newInput = { workspaceId: "ws_northstar", siteId: "site_central", templateId: "form_safety_walk", templateVersion: 3, title: "Safety Walk", inspectorId: "u_inspector" }
const code = (expected: string) => (error: unknown) => error instanceof InspectionError && error.code === expected
const submitted = (repository: LocalInspectionRepository): InspectionRecord => {
  const record = repository.create(newInput)
  return repository.submit(record.id, [{ questionId: "q", value: "yes" }], record.revision)
}

test("inspection repository seeds mock records and scopes by workspace", () => withStorage((repository) => { assert.equal(repository.list().length, 5); assert.equal(repository.list("ws_northstar").length, 4) }))

test("create and draft save increment revisions and retain answers", () => withStorage((repository) => {
  const record = repository.create(newInput)
  assert.equal(record.revision, 1)
  const saved = repository.saveDraft(record.id, [{ questionId: "q1", value: true }], record.revision)
  assert.equal(saved.revision, 2)
  assert.equal(saved.status, "in_progress")
  assert.deepEqual(saved.answers[0].value, true)
}))

test("stale writes are rejected without overwriting the latest revision", () => withStorage((repository) => {
  const record = repository.get("INS-2026-0145")!
  repository.saveDraft(record.id, [{ questionId: "q", value: "new" }], record.revision)
  assert.throws(() => repository.saveDraft(record.id, [], record.revision), RevisionConflictError)
  assert.throws(() => repository.saveDraft(record.id, [], record.revision), code("STALE_REVISION"))
  assert.equal(repository.get(record.id)?.answers[0].value, "new")
}))

test("submit starts review at the first stage and returning requires a reason", () => withStorage((repository) => {
  const record = submitted(repository)
  assert.equal(record.status, "submitted")
  assert.equal(record.currentStage, "reviewer_1")
  assert.throws(() => repository.review(record.id, { decision: "returned", actorId: "u_r1", expectedRevision: record.revision }), /reason is required/)
  assert.throws(() => repository.review(record.id, { decision: "returned", actorId: "u_r1", reason: "no", expectedRevision: record.revision }), code("REASON_REQUIRED"))
  const returned = repository.review(record.id, { decision: "returned", actorId: "u_r1", reason: "Add evidence", expectedRevision: record.revision })
  assert.equal(returned.status, "returned")
  assert.equal(returned.currentStage, null)
  assert.equal(returned.reviewHistory[0].reason, "Add evidence")
}))

test("approval moves through three stages and ends approved", () => withStorage((repository) => {
  let record = submitted(repository)
  record = repository.review(record.id, { decision: "approved", actorId: "u_r1", stage: "reviewer_1", expectedRevision: record.revision })
  assert.equal(record.status, "in_review"); assert.equal(record.currentStage, "reviewer_2")
  record = repository.review(record.id, { decision: "approved", actorId: "u_r2", stage: "reviewer_2", expectedRevision: record.revision })
  assert.equal(record.status, "in_review"); assert.equal(record.currentStage, "final_reviewer")
  record = repository.review(record.id, { decision: "approved", actorId: "u_final", stage: "final_reviewer", expectedRevision: record.revision })
  assert.equal(record.status, "approved"); assert.equal(record.currentStage, null)
  assert.deepEqual(record.reviewHistory.map((entry) => entry.stage), ["reviewer_1", "reviewer_2", "final_reviewer"])
}))

test("a return at any stage resets, and resubmission restarts at the first stage", () => withStorage((repository) => {
  let record = submitted(repository)
  record = repository.review(record.id, { decision: "approved", actorId: "u_r1", expectedRevision: record.revision })
  record = repository.review(record.id, { decision: "returned", actorId: "u_r2", reason: "Photos are unclear", expectedRevision: record.revision })
  assert.equal(record.status, "returned"); assert.equal(record.currentStage, null)
  const draft = repository.saveDraft(record.id, [{ questionId: "q", value: "fixed" }], record.revision)
  const again = repository.submit(draft.id, draft.answers, draft.revision)
  assert.equal(again.currentStage, "reviewer_1")
  assert.equal(again.cycle, 2)
}))

test("separation of duties and stage checks are enforced by the repository", () => withStorage((repository) => {
  let record = submitted(repository)
  assert.throws(() => repository.review(record.id, { decision: "approved", actorId: "u_inspector", expectedRevision: record.revision }), code("SELF_REVIEW"))
  assert.throws(() => repository.review(record.id, { decision: "approved", actorId: "u_r2", stage: "reviewer_2", expectedRevision: record.revision }), code("WRONG_STAGE"))
  record = repository.review(record.id, { decision: "approved", actorId: "u_r1", expectedRevision: record.revision })
  assert.throws(() => repository.review(record.id, { decision: "approved", actorId: "u_r1", expectedRevision: record.revision }), code("ALREADY_REVIEWED"))
}))

test("a review decision on an inspection that is not waiting is rejected", () => withStorage((repository) => {
  const record = repository.get("INS-2026-0145")!
  assert.throws(() => repository.review(record.id, { decision: "approved", actorId: "u_r1", expectedRevision: record.revision }), code("NOT_WAITING_FOR_REVIEW"))
}))

test("stale review decisions are rejected", () => withStorage((repository) => {
  const record = submitted(repository)
  repository.review(record.id, { decision: "approved", actorId: "u_r1", expectedRevision: record.revision })
  assert.throws(() => repository.review(record.id, { decision: "approved", actorId: "u_r2", expectedRevision: record.revision }), RevisionConflictError)
}))

test("a per-template review chain override is respected", () => withStorage((repository) => {
  const created = repository.create({ ...newInput, reviewStages: ["reviewer_1", "final_reviewer"] })
  let record = repository.submit(created.id, [], created.revision)
  record = repository.review(record.id, { decision: "approved", actorId: "u_r1", expectedRevision: record.revision })
  assert.equal(record.currentStage, "final_reviewer")
  record = repository.review(record.id, { decision: "approved", actorId: "u_final", expectedRevision: record.revision })
  assert.equal(record.status, "approved")
}))

test("overdue is derived and resolved inspections are not overdue", () => {
  const now = new Date("2026-11-20T12:00:00Z")
  assert.equal(isOverdue({ status: "draft", dueAt: "2026-11-19T12:00:00Z" }, now), true)
  assert.equal(isOverdue({ status: "draft", dueAt: "2026-11-21T12:00:00Z" }, now), false)
  assert.equal(isOverdue({ status: "submitted", dueAt: "2026-11-19T12:00:00Z" }, now), false)
})
