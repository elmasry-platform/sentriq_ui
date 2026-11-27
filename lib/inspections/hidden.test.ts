import test from "node:test"
import assert from "node:assert/strict"
import { createQuestion, emptyForm } from "../forms/domain.ts"
import { effectiveAnswers } from "./hidden.ts"

function build() {
  const form = emptyForm(); const sid = form.sections[0].id
  const a = createQuestion("boolean", sid), b = createQuestion("short_text", sid), c = createQuestion("short_text", sid)
  b.conditions = [{ id: "r1", sourceQuestionId: a.id, operator: "equals", value: true, targetQuestionId: b.id, effect: "show" }]
  c.conditions = [{ id: "r2", sourceQuestionId: b.id, operator: "equals", value: "x", targetQuestionId: c.id, effect: "show" }]
  form.questions.push(a, b, c); form.sections[0].questionIds.push(a.id, b.id, c.id)
  return { form, a, b, c }
}
test("an answer to a hidden question is not sent or scored", () => {
  const { form, a, b } = build()
  const result = effectiveAnswers(form, { [a.id]: false, [b.id]: "kept" })
  assert.equal(result[b.id], undefined); assert.equal(result[a.id], false)
})
test("hiding one question also hides the one that depended on it", () => {
  const { form, a, b, c } = build()
  const result = effectiveAnswers(form, { [a.id]: false, [b.id]: "x", [c.id]: "deep" })
  assert.equal(result[b.id], undefined); assert.equal(result[c.id], undefined)
})
test("toggling back restores what the device still holds", () => {
  const { form, a, b } = build()
  const local = { [a.id]: false, [b.id]: "kept" }
  assert.equal(effectiveAnswers(form, local)[b.id], undefined)
  assert.equal(effectiveAnswers(form, { ...local, [a.id]: true })[b.id], "kept")
})
