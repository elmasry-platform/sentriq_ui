import test from "node:test"
import assert from "node:assert/strict"
import { emptyForm, createQuestion } from "../forms/domain.ts"
import { droppedAnswers, hiddenWithFindings } from "./hidden.ts"

function form() {
  const f = emptyForm(); const s = f.sections[0]
  const a = { ...createQuestion("boolean", s.id), id: "a" }, b = { ...createQuestion("short_text", s.id), id: "b" }, c = { ...createQuestion("short_text", s.id), id: "c" }
  a.conditions = [{ id: "rule_hide_b", sourceQuestionId: "a", operator: "equals", value: false, targetQuestionId: "b", effect: "hide" }]
  b.conditions = [{ id: "rule_show_c", sourceQuestionId: "b", operator: "is_not_empty", value: "", targetQuestionId: "c", effect: "show" }]
  f.questions = [a, b, c]; s.questionIds = ["a", "b", "c"]; return f
}
test("dropped answers name the question and the rule that hid it, including chained hides", () => {
  const out = droppedAnswers(form(), { a: false, b: "bad", c: "worse" })
  assert.deepEqual(out.map((d) => [d.questionId, d.reason, d.ruleIds]), [["b", "hide_rule", ["rule_hide_b"]], ["c", "show_rule_not_met", ["rule_show_c"]]])
})
test("nothing hidden, nothing dropped; unanswered hidden questions are not listed", () => {
  assert.deepEqual(droppedAnswers(form(), { a: true, b: "x", c: "y" }), [])
  assert.deepEqual(droppedAnswers(form(), { a: false }), [])
})
test("changing an answer that hides a question with a finding is reported, so the person must confirm and the finding stays", () => {
  const f = form(); const findings = [{ questionId: "b" }]
  assert.deepEqual(hiddenWithFindings(f, { a: true, b: "bad" }, { a: false, b: "bad" }, findings), ["b"])
  assert.deepEqual(hiddenWithFindings(f, { a: true, b: "bad" }, { a: true, b: "ok" }, findings), [])
  assert.deepEqual(hiddenWithFindings(f, { a: false, b: "bad" }, { a: false, b: "bad" }, findings), []) // already hidden
})
