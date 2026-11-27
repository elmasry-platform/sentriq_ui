import test from "node:test"
import assert from "node:assert/strict"
import { createOutbox, pendingCount, wipeAllOutboxes, wipeOtherUsers } from "./outbox.ts"
import { LocalInspectionRepository, InspectionError } from "./repository.ts"

function memoryStore() { const m = new Map<string, string>(); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) }, key: (i: number) => [...m.keys()][i] ?? null, get length() { return m.size } } }
const A = { userId: "u_a", workspaceId: "ws_1" }
function setup() {
  const store = memoryStore()
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: store })
  const repository = new LocalInspectionRepository()
  const record = repository.create({ workspaceId: "ws_1", siteId: "site_central", templateId: "form_safety_walk", templateVersion: 3, title: "Walk", inspectorId: "u_a" })
  return { store, repository, record, outbox: createOutbox(A, store) }
}
const rows = (value: unknown) => [{ questionId: "q1", value }]
const input = (record: { id: string; revision: number }, value: unknown) => ({ inspectionId: record.id, expectedRevision: record.revision, answers: rows(value), findings: [] })

test("offline: submission is queued, not submitted, and the record stays out of review", () => {
  const { repository, record, outbox } = setup()
  outbox.enqueue(input(record, "yes"))
  assert.equal(outbox.flush(repository, false)[0].outcome, "offline")
  assert.equal(repository.get(record.id)?.status, "draft"); assert.equal(outbox.read().length, 1)
})
test("back online: the queue sends once and empties", () => {
  const { repository, record, outbox } = setup()
  outbox.enqueue(input(record, "yes"))
  assert.equal(outbox.flush(repository, true)[0].outcome, "submitted")
  assert.equal(repository.get(record.id)?.status, "submitted"); assert.equal(outbox.read().length, 0)
})
test("double tap or restart with the same answers reuses one entry and one client id", () => {
  const { record, outbox } = setup()
  const a = outbox.enqueue(input(record, "yes")), b = outbox.enqueue(input(record, "yes"))
  assert.equal(a.clientId, b.clientId); assert.equal(outbox.read().length, 1)
})
test("edits made while queued are kept: changed answers replace the entry and get a new client id", () => {
  const { record, outbox } = setup()
  const first = outbox.enqueue(input(record, "yes")), second = outbox.enqueue(input(record, "no"))
  assert.notEqual(first.clientId, second.clientId)
  assert.equal(outbox.read().length, 1); assert.deepEqual(outbox.entry(record.id)?.answers, rows("no"))
})
test("five forced retries with the same client id give one submission", () => {
  const { repository, record, outbox } = setup()
  const entry = outbox.enqueue(input(record, "yes"))
  const first = repository.submit(record.id, entry.answers, entry.expectedRevision, entry.findings, entry.clientId)
  for (let i = 0; i < 5; i++) { const again = repository.submit(record.id, entry.answers, entry.expectedRevision, entry.findings, entry.clientId); assert.equal(again.revision, first.revision); assert.equal(again.cycle, first.cycle) }
  assert.equal(repository.get(record.id)?.cycle, 1)
})
test("same client id with different answers is refused and nothing is overwritten", () => {
  const { repository, record, outbox } = setup()
  const entry = outbox.enqueue(input(record, "yes"))
  repository.submit(record.id, entry.answers, entry.expectedRevision, entry.findings, entry.clientId)
  assert.throws(() => repository.submit(record.id, rows("no"), entry.expectedRevision, [], entry.clientId), (e: unknown) => e instanceof InspectionError && e.code === "CLIENT_ID_PAYLOAD_MISMATCH")
  assert.deepEqual(repository.get(record.id)?.answers, rows("yes"))
})
test("server conflict keeps the unsent answers, stops retrying, and a revised payload can be sent", () => {
  const { repository, record, outbox } = setup()
  repository.saveDraft(record.id, rows("server"), record.revision)
  outbox.enqueue(input(record, "mine"))
  assert.equal(outbox.flush(repository, true)[0].outcome, "conflict")
  assert.equal(outbox.entry(record.id)?.state, "conflict"); assert.deepEqual(outbox.entry(record.id)?.answers, rows("mine"))
  assert.equal(outbox.flush(repository, true).length, 0)
  const latest = repository.get(record.id)!
  outbox.enqueue({ inspectionId: record.id, expectedRevision: latest.revision, answers: rows("mine"), findings: [] })
  assert.equal(outbox.flush(repository, true)[0].outcome, "submitted")
})
test("blocked entry keeps the answers, can be exported, and can be dismissed", () => {
  const { repository, record, outbox } = setup()
  outbox.enqueue(input(record, "mine"))
  repository.submit(record.id, rows("other device"), record.revision)
  const result = outbox.flush(repository, true)[0]
  assert.ok(["blocked", "conflict"].includes(result.outcome))
  assert.match(outbox.exportBlocked(record.id) ?? "", /mine/)
  outbox.discard(record.id); assert.equal(outbox.read().length, 0)
})
test("OF-07: a second user or another company never sees or sends the queue", () => {
  const { store, repository, record, outbox } = setup()
  outbox.enqueue(input(record, "mine"))
  const otherUser = createOutbox({ userId: "u_b", workspaceId: "ws_1" }, store)
  const otherCompany = createOutbox({ userId: "u_a", workspaceId: "ws_2" }, store)
  assert.equal(otherUser.read().length, 0); assert.equal(otherCompany.read().length, 0)
  assert.equal(otherUser.flush(repository, true).length, 0)
  assert.equal(repository.get(record.id)?.status, "draft")
})
test("OF-07: sign out wipes every queue on the device, including the old shared key", () => {
  const { store, record, outbox } = setup()
  outbox.enqueue(input(record, "mine")); createOutbox({ userId: "u_b", workspaceId: "ws_2" }, store).enqueue(input(record, "x"))
  store.setItem("sentriq.inspections.outbox.v1", "[]"); store.setItem("unrelated", "keep")
  wipeAllOutboxes(store)
  assert.equal(outbox.read().length, 0); assert.equal(store.getItem("sentriq.inspections.outbox.v1"), null); assert.equal(store.getItem("unrelated"), "keep")
})
test("an outbox needs a user and a company", () => { assert.throws(() => createOutbox({ userId: "", workspaceId: "w" }, memoryStore())) })

test("sign out warning: pendingCount counts every queue on the device, zero when empty", () => {
  const { store, record, outbox } = setup()
  assert.equal(pendingCount(store), 0)
  outbox.enqueue(input(record, "yes"))
  assert.equal(pendingCount(store), 1)
  wipeAllOutboxes(store); assert.equal(pendingCount(store), 0)
})
test("entries older than the purge age are dropped; fresh ones stay", () => {
  const { store, record, outbox } = setup()
  outbox.enqueue(input(record, "yes"))
  const key = [...store.m.keys()].find((k) => k.includes("outbox.v2"))!
  const rows = JSON.parse(store.m.get(key)!); rows[0].queuedAt = new Date(Date.now() - 15 * 86_400_000).toISOString(); store.m.set(key, JSON.stringify(rows))
  assert.equal(outbox.read().length, 0)
  outbox.enqueue(input(record, "no")); assert.equal(outbox.read().length, 1)
})
test("signing in as someone else removes the old user's queue, keeps your own", () => {
  const { store, record, outbox } = setup()
  outbox.enqueue(input(record, "yes"))
  const other = createOutbox({ userId: "u_b", workspaceId: "ws_1" }, store); other.enqueue(input(record, "no"))
  wipeOtherUsers("u_b", store)
  assert.equal(outbox.read().length, 0); assert.equal(other.read().length, 1)
})
