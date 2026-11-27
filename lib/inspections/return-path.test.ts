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
