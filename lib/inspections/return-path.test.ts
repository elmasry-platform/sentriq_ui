import test from "node:test"
import assert from "node:assert/strict"
import { returnPath, changedAnswers } from "./policy.ts"
import { LocalInspectionRepository } from "./repository.ts"

const r = (questionId: string, value: unknown) => ({ questionId, value })
const base = [r("q1", "a"), r("q2", "b"), r("q3", ["x", "y"])]
const go = (flagged: string[], after: ReturnType<typeof r>[], stage = "reviewer_2", before = base) =>
  returnPath({ returnedStage: stage, firstStage: "reviewer_1", flaggedQuestionIds: flagged, returned: before, resubmitted: after })

test("only flagged answers changed: resume at the returning stage", () => assert.equal(go(["q1"], [r("q1", "z"), r("q2", "b"), r("q3", ["x", "y"])]).path, "resume"))
test("flagged and unflagged changed: restart at stage 1", () => { const p = go(["q1"], [r("q1", "z"), r("q2", "c"), r("q3", ["x", "y"])]); assert.equal(p.path, "restart"); assert.equal(p.stage, "reviewer_1"); assert.deepEqual(p.changedFlagged, ["q1"]); assert.deepEqual(p.changedUnflagged, ["q2"]) })
test("nothing changed: resume", () => assert.equal(go(["q1"], base).path, "resume"))
test("no flags and a change: restart at stage 1", () => assert.equal(go([], [r("q1", "z"), r("q2", "b"), r("q3", ["x", "y"])]).path, "restart"))
test("no flags and no change: resume", () => assert.equal(go([], base).path, "resume"))
test("change and revert is no change", () => { const mid = [r("q1", "z"), ...base.slice(1)]; assert.deepEqual(changedAnswers(base, mid), ["q1"]); assert.deepEqual(changedAnswers(base, [...mid.slice(0, 0), ...base]), []) })
test("same multi-choice content in another order is no change", () => assert.deepEqual(changedAnswers(base, [r("q1", "a"), r("q2", "b"), r("q3", ["y", "x"])]), []))
test("empty answers are equal: blank, missing, empty list", () => assert.deepEqual(changedAnswers([r("q1", ""), r("q3", [])], [r("q2", null)]), []))
test("stage 3 return resumes at stage 3", () => assert.equal(go(["q1"], [r("q1", "z"), ...base.slice(1)], "final_reviewer").stage, "final_reviewer"))

function returned(flagged: string[]) {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: (() => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) } } })() })
  const repo = new LocalInspectionRepository()
  let rec = repo.create({ workspaceId: "w", siteId: "s", templateId: "t", templateVersion: 1, title: "T", inspectorId: "insp" })
  rec = repo.submit(rec.id, base, rec.revision)
  for (const stage of ["reviewer_1", "reviewer_2"]) rec = repo.review(rec.id, { decision: "approved", actorId: `rev_${stage}`, expectedRevision: rec.revision, stage } as never)
  rec = repo.review(rec.id, { decision: "returned", actorId: "rev_f", reason: "Fix it", flaggedQuestionIds: flagged, expectedRevision: rec.revision } as never)
  return { repo, rec }
}
test("repository: flagged-only change resumes at the returning stage and history records which answers changed", () => {
  const { repo, rec } = returned(["q1"])
  const out = repo.submit(rec.id, [r("q1", "z"), ...base.slice(1)], rec.revision)
  assert.equal(out.currentStage, "final_reviewer")
  const last = out.submissionHistory!.at(-1)!
  assert.deepEqual([last.kind, last.path, last.changedQuestionIds], ["resubmitted", "resume", ["q1"]])
})
test("repository: an unflagged change restarts at stage 1 and the earlier history is kept", () => {
  const { repo, rec } = returned(["q1"])
  const out = repo.submit(rec.id, [r("q1", "z"), r("q2", "other"), base[2]], rec.revision)
  assert.equal(out.currentStage, "reviewer_1"); assert.equal(out.reviewHistory.length, 3); assert.equal(out.submissionHistory!.length, 2)
})
test("repository: a draft edit before resubmitting does not move the baseline; a second return compares to the latest version", () => {
  const { repo, rec } = returned(["q1"])
  const draft = repo.saveDraft(rec.id, [r("q1", "z"), ...base.slice(1)], rec.revision)
  const again = repo.submit(rec.id, [r("q1", "z"), ...base.slice(1)], draft.revision)
  assert.equal(again.currentStage, "final_reviewer")
  const second = repo.review(rec.id, { decision: "returned", actorId: "rev_f", reason: "Again", flaggedQuestionIds: ["q2"], expectedRevision: again.revision } as never)
  const out = repo.submit(rec.id, [r("q1", "z"), r("q2", "n"), base[2]], second.revision)
  assert.deepEqual(out.submissionHistory!.at(-1)!.changedQuestionIds, ["q2"]); assert.equal(out.currentStage, "final_reviewer")
})

test("repository: unchanged resubmission needs a written reply of 10 characters, resumes at the returning stage, and is marked in history", () => {
  const { repo, rec } = returned(["q1"])
  assert.throws(() => repo.submit(rec.id, base, rec.revision), { code: "REPLY_REQUIRED" })
  assert.throws(() => repo.submit(rec.id, base, rec.revision, [], undefined, { reply: "too short" }), { code: "REPLY_REQUIRED" }) // 9 characters
  const out = repo.submit(rec.id, base, rec.revision, [], undefined, { reply: "Checked again, all is fine." })
  assert.equal(out.currentStage, "final_reviewer")
  const last = out.submissionHistory!.at(-1)!
  assert.deepEqual([last.kind, last.path, last.reply], ["resubmitted_without_change", "resume", "Checked again, all is fine."])
})
test("repository: audit of dropped hidden answers is stored with the submission", () => {
  const { repo, rec } = returned(["q1"])
  const dropped = [{ questionId: "q2", ruleIds: ["c1"], reason: "hide_rule" }]
  const out = repo.submit(rec.id, [r("q1", "z"), ...base.slice(1)], rec.revision, [], undefined, { droppedHidden: dropped })
  assert.deepEqual(out.submissionHistory!.at(-1)!.droppedHidden, dropped)
})

function approvedRecord() {
  const { repo, rec } = returned(["q1"])
  let x = repo.submit(rec.id, [r("q1", "z"), ...base.slice(1)], rec.revision)
  x = repo.review(x.id, { decision: "approved", actorId: "rev_f", expectedRevision: x.revision, stage: "final_reviewer" } as never)
  return { repo, rec: x }
}
test("reopen: only from approved, reason of 5 characters, approval stays in history, earlier approvers are listed", () => {
  const { repo, rec } = approvedRecord(); assert.equal(rec.status, "approved")
  assert.throws(() => repo.reopen(rec.id, { actorId: "admin", reason: "abcd", expectedRevision: rec.revision }), { code: "REASON_REQUIRED" })
  const out = repo.reopen(rec.id, { actorId: "admin", reason: "abcde", expectedRevision: rec.revision })
  assert.equal(out.status, "returned"); assert.ok(out.revision > rec.revision)
  assert.equal(out.reviewHistory.filter((e) => e.decision === "approved").length, rec.reviewHistory.filter((e) => e.decision === "approved").length)
  const last = out.reviewHistory.at(-1)!
  assert.deepEqual([last.decision, last.reason], ["reopened", "abcde"]); assert.deepEqual(last.notified, ["rev_f"])
})
test("reopen: refused when not approved, and refused after the hard lock days", () => {
  const { repo, rec } = returned([]); assert.throws(() => repo.reopen(rec.id, { actorId: "a", reason: "long enough", expectedRevision: rec.revision }), { code: "REOPEN_NOT_APPROVED" })
  const ok = approvedRecord()
  assert.throws(() => ok.repo.reopen(ok.rec.id, { actorId: "a", reason: "long enough", expectedRevision: ok.rec.revision, lockAfterDays: -1 }), { code: "REOPEN_LOCKED" })
})
test("reopen: a resubmission goes through the same return-path rule and keeps the full history", () => {
  const { repo, rec } = approvedRecord()
  const re = repo.reopen(rec.id, { actorId: "admin", reason: "New evidence", expectedRevision: rec.revision })
  const out = repo.submit(re.id, [r("q1", "z"), r("q2", "changed"), base[2]], re.revision)
  assert.equal(out.currentStage, "reviewer_1") // a change with no flags restarts at stage 1
  assert.ok(out.reviewHistory.length >= rec.reviewHistory.length + 1)
})

import { charCount } from "./policy.ts"
test("reply length counts what people see: Arabic, emoji (1 each) and trimmed spaces", () => {
  assert.equal(charCount("  مرحبا  "), 5); assert.equal(charCount("👍👍👍"), 3); assert.equal(charCount(undefined), 0)
  assert.equal(charCount("👍".repeat(10)), 10) // 10 emoji = 10 characters, enough
  const { repo, rec } = returned(["q1"])
  assert.throws(() => repo.submit(rec.id, base, rec.revision, [], undefined, { reply: "مراجعة تمت" .slice(0, 9) }), { code: "REPLY_REQUIRED" })
  assert.doesNotThrow(() => repo.submit(rec.id, base, rec.revision, [], undefined, { reply: "تمت المراجعة مرة أخرى" }))
})
