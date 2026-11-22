import test from "node:test"
import assert from "node:assert/strict"
import { ActionError, LocalActionRepository, daysOverdue, isActionOverdue } from "./repository.ts"

function withStorage(run: (repository: LocalActionRepository) => void) {
  const stored = new Map<string, string>()
  const previous = globalThis.localStorage
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => { stored.set(key, value) } } as Storage })
  try { run(new LocalActionRepository()) } finally { Object.defineProperty(globalThis, "localStorage", { configurable: true, value: previous }) }
}
const input = { workspaceId: "ws_northstar", siteId: "site_central", findingId: "FND-1", inspectionId: "INS-2026-0148", title: "Fix exit door", ownerId: "u_owner", priority: "high" as const, closureDueAt: "2026-11-25T17:00:00Z" }
const code = (expected: string) => (error: unknown) => error instanceof ActionError && error.code === expected

test("seeds mock actions and scopes by workspace", () => withStorage((repository) => { assert.ok(repository.list().length >= 3); assert.ok(repository.list("ws_northstar").every((item) => item.workspaceId === "ws_northstar")) }))

test("an action is created open and linked to its finding and inspection", () => withStorage((repository) => {
  const created = repository.create(input)
  assert.equal(created.status, "open"); assert.equal(created.findingId, "FND-1"); assert.equal(created.inspectionId, "INS-2026-0148")
  assert.equal(repository.listForInspection("INS-2026-0148").some((item) => item.id === created.id), true)
}))

test("owner moves open -> in_progress -> closure_requested and a verifier closes", () => withStorage((repository) => {
  let record = repository.create(input)
  record = repository.transition(record.id, { to: "in_progress", actorId: "u_owner", canVerify: false, expectedRevision: record.revision })
  record = repository.transition(record.id, { to: "closure_requested", actorId: "u_owner", canVerify: false, expectedRevision: record.revision })
  record = repository.transition(record.id, { to: "closed", actorId: "u_closure", canVerify: true, expectedRevision: record.revision })
  assert.equal(record.status, "closed"); assert.equal(record.updates.length, 4)
}))

test("invalid transitions are rejected", () => withStorage((repository) => {
  const record = repository.create(input)
  assert.throws(() => repository.transition(record.id, { to: "closed", actorId: "u_closure", canVerify: true, expectedRevision: record.revision }), code("INVALID_TRANSITION"))
  assert.throws(() => repository.transition(record.id, { to: "closure_requested", actorId: "u_owner", canVerify: false, expectedRevision: record.revision }), code("INVALID_TRANSITION"))
}))

test("only the owner starts work; only a verifier closes or returns; owner cannot verify own action", () => withStorage((repository) => {
  let record = repository.create(input)
  assert.throws(() => repository.transition(record.id, { to: "in_progress", actorId: "u_other", canVerify: false, expectedRevision: record.revision }), code("NOT_OWNER"))
  record = repository.transition(record.id, { to: "in_progress", actorId: "u_owner", canVerify: false, expectedRevision: record.revision })
  record = repository.transition(record.id, { to: "closure_requested", actorId: "u_owner", canVerify: false, expectedRevision: record.revision })
  assert.throws(() => repository.transition(record.id, { to: "closed", actorId: "u_inspector", canVerify: false, expectedRevision: record.revision }), code("NOT_VERIFIER"))
  assert.throws(() => repository.transition(record.id, { to: "closed", actorId: "u_owner", canVerify: true, expectedRevision: record.revision }), code("SELF_VERIFY"))
}))

test("returning for rework needs a reason and moves back to in_progress", () => withStorage((repository) => {
  let record = repository.create(input)
  record = repository.transition(record.id, { to: "in_progress", actorId: "u_owner", canVerify: false, expectedRevision: record.revision })
  record = repository.transition(record.id, { to: "closure_requested", actorId: "u_owner", canVerify: false, expectedRevision: record.revision })
  assert.throws(() => repository.transition(record.id, { to: "in_progress", actorId: "u_closure", canVerify: true, expectedRevision: record.revision }), code("REASON_REQUIRED"))
  record = repository.transition(record.id, { to: "in_progress", actorId: "u_closure", canVerify: true, reason: "Photo does not show the fix", expectedRevision: record.revision })
  assert.equal(record.status, "in_progress")
}))

test("stale revisions are rejected", () => withStorage((repository) => {
  const record = repository.create(input)
  repository.transition(record.id, { to: "in_progress", actorId: "u_owner", canVerify: false, expectedRevision: record.revision })
  assert.throws(() => repository.transition(record.id, { to: "in_progress", actorId: "u_owner", canVerify: false, expectedRevision: record.revision }), code("STALE_REVISION"))
}))

test("overdue is derived from the closure date and status", () => {
  const now = new Date("2026-11-28T12:00:00Z")
  assert.equal(isActionOverdue({ status: "open", closureDueAt: "2026-11-25T12:00:00Z" }, now), true)
  assert.equal(daysOverdue({ status: "open", closureDueAt: "2026-11-25T12:00:00Z" }, now), 3)
  assert.equal(isActionOverdue({ status: "closed", closureDueAt: "2026-11-25T12:00:00Z" }, now), false)
  assert.equal(isActionOverdue({ status: "open", closureDueAt: "2026-12-01T12:00:00Z" }, now), false)
})
