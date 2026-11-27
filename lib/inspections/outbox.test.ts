import test from "node:test"
import assert from "node:assert/strict"
import { discardQueued, enqueueSubmission, flushOutbox, outboxEntry, readOutbox, reviseQueued } from "./outbox.ts"
import { LocalInspectionRepository, InspectionError } from "./repository.ts"

function memoryStore() { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } } }
function setup() {
  const store = memoryStore()
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: store })
  const repository = new LocalInspectionRepository()
  const record = repository.create({ workspaceId: "ws_northstar", siteId: "site_central", templateId: "form_safety_walk", templateVersion: 3, title: "Walk", inspectorId: "u_inspector" })
  return { store, repository, record }
}
const rows = (value: unknown) => [{ questionId: "q1", value }]

test("offline: submission is queued, not submitted, and the record stays out of review", () => {
  const { store, repository, record } = setup()
  enqueueSubmission({ inspectionId: record.id, expectedRevision: record.revision, answers: rows("yes"), findings: [] }, store)
  const result = flushOutbox(repository, false, store)
  assert.equal(result[0].outcome, "offline")
  assert.equal(repository.get(record.id)?.status, "draft")
  assert.equal(readOutbox(store).length, 1)
})
test("back online: the queue sends once and empties", () => {
  const { store, repository, record } = setup()
  enqueueSubmission({ inspectionId: record.id, expectedRevision: record.revision, answers: rows("yes"), findings: [] }, store)
  const result = flushOutbox(repository, true, store)
  assert.equal(result[0].outcome, "submitted")
  assert.equal(repository.get(record.id)?.status, "submitted")
  assert.equal(readOutbox(store).length, 0)
})
test("double tap or restart reuses one entry and one client id", () => {
  const { store, record } = setup()
  const a = enqueueSubmission({ inspectionId: record.id, expectedRevision: record.revision, answers: rows("yes"), findings: [] }, store)
  const b = enqueueSubmission({ inspectionId: record.id, expectedRevision: record.revision, answers: rows("yes"), findings: [] }, store)
  assert.equal(a.clientId, b.clientId); assert.equal(readOutbox(store).length, 1)
})
test("five forced retries with the same client id give one submission", () => {
  const { store, repository, record } = setup()
  const entry = enqueueSubmission({ inspectionId: record.id, expectedRevision: record.revision, answers: rows("yes"), findings: [] }, store)
  const first = repository.submit(record.id, entry.answers, entry.expectedRevision, entry.findings, entry.clientId)
  for (let i = 0; i < 5; i++) { const again = repository.submit(record.id, entry.answers, entry.expectedRevision, entry.findings, entry.clientId); assert.equal(again.revision, first.revision); assert.equal(again.cycle, first.cycle) }
  assert.equal(repository.get(record.id)?.cycle, 1)
})
test("same client id with different answers is refused and nothing is overwritten", () => {
  const { store, repository, record } = setup()
  const entry = enqueueSubmission({ inspectionId: record.id, expectedRevision: record.revision, answers: rows("yes"), findings: [] }, store)
  repository.submit(record.id, entry.answers, entry.expectedRevision, entry.findings, entry.clientId)
  assert.throws(() => repository.submit(record.id, rows("no"), entry.expectedRevision, [], entry.clientId), (e: unknown) => e instanceof InspectionError && e.code === "CLIENT_ID_PAYLOAD_MISMATCH")
  assert.deepEqual(repository.get(record.id)?.answers, rows("yes"))
})
test("server conflict keeps the unsent answers on the device and stops retrying", () => {
  const { store, repository, record } = setup()
  repository.saveDraft(record.id, rows("server"), record.revision)
  enqueueSubmission({ inspectionId: record.id, expectedRevision: record.revision, answers: rows("mine"), findings: [] }, store)
  const result = flushOutbox(repository, true, store)
  assert.equal(result[0].outcome, "conflict")
  assert.equal(outboxEntry(record.id, store)?.state, "conflict")
  assert.deepEqual(outboxEntry(record.id, store)?.answers, rows("mine"))
  assert.equal(flushOutbox(repository, true, store).length, 0)
  const latest = repository.get(record.id)!
  reviseQueued(record.id, { expectedRevision: latest.revision, answers: rows("mine"), findings: [] }, store)
  assert.equal(flushOutbox(repository, true, store)[0].outcome, "submitted")
})
test("inspection no longer editable while offline: entry is blocked, answers kept, nothing lost", () => {
  const { store, repository, record } = setup()
  const entry = enqueueSubmission({ inspectionId: record.id, expectedRevision: record.revision, answers: rows("mine"), findings: [] }, store)
  repository.submit(record.id, rows("other device"), record.revision)
  assert.equal(entry.state, "queued")
  const result = flushOutbox(repository, true, store)
  assert.ok(["blocked", "conflict"].includes(result[0].outcome))
  assert.deepEqual(outboxEntry(record.id, store)?.answers, rows("mine"))
  discardQueued(record.id, store); assert.equal(readOutbox(store).length, 0)
})
