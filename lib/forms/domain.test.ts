import test from "node:test"
import assert from "node:assert/strict"
import { answerableCount, canAddAnswerable, createQuestion, duplicateForm, emptyForm, validateAnswer, validateForm } from "./domain.ts"

const add = (form: ReturnType<typeof emptyForm>, type: "short_text" | "instruction" | "repeat_group" = "short_text") => { const question = createQuestion(type, form.sections[0].id); if (type === "repeat_group") question.config.children = [{ id: "child_a", type: "integer", label: { en: "Child", ar: "فرعي" }, required: false, config: {} }]; form.questions.push(question); form.sections[0].questionIds.push(question.id); return question }
test("instruction is zero capacity; normal and repeat fields count once", () => { const form = emptyForm(); add(form); add(form, "instruction"); add(form, "repeat_group"); assert.equal(answerableCount(form), 2) })
test("capacity allows 150 and rejects the next answerable field", () => { const form = emptyForm(); for (let i = 0; i < 150; i++) add(form); assert.equal(answerableCount(form), 150); assert.equal(canAddAnswerable(form), false) })
test("duplication rejects forms beyond the answerable-question limit", () => {
  const form = emptyForm()
  for (let index = 0; index < 151; index++) add(form)
  assert.throws(() => duplicateForm(form), /cannot exceed 150/)
})
test("duplication remaps stable ids, creates draft, and excludes published snapshots", () => { const form = emptyForm(); const source = add(form); const target = add(form); target.conditions.push({ id: "r1", sourceQuestionId: source.id, operator: "equals", value: "yes", targetQuestionId: target.id, effect: "show" }); const copy = duplicateForm(form); assert.notEqual(copy.id, form.id); assert.notEqual(copy.questions[0].id, source.id); assert.equal(copy.questions[1].conditions[0].sourceQuestionId, copy.questions[0].id); assert.equal(copy.questions[1].conditions[0].targetQuestionId, copy.questions[1].id); assert.equal(copy.status, "Draft"); assert.equal(copy.publishedVersions.length, 0) })
test("integer accepts zero and rejects fractional values", () => { const question = createQuestion("integer", "s"); assert.equal(validateAnswer(question, 0), undefined); assert.equal(validateAnswer(question, 1.5), "Enter a whole number.") })
test("publish validation blocks empty form", () => { assert.ok(validateForm(emptyForm()).some((item) => item.message.includes("at least one"))) })
test("condition effects control visibility, required state, and evidence", async () => {
  const { getQuestionRuntimeStates } = await import("./domain.ts")
  const form = emptyForm()
  const source = add(form)
  const target = add(form)
  target.conditions = [
    { id: "show-rule", sourceQuestionId: source.id, operator: "equals", value: "yes", targetQuestionId: target.id, effect: "show" },
    { id: "required-rule", sourceQuestionId: source.id, operator: "equals", value: "yes", targetQuestionId: target.id, effect: "require" },
    { id: "evidence-rule", sourceQuestionId: source.id, operator: "equals", value: "yes", targetQuestionId: target.id, effect: "require_evidence" },
  ]
  assert.equal(getQuestionRuntimeStates(form, { [source.id]: "yes" })[target.id].visible, true)
  assert.equal(getQuestionRuntimeStates(form, { [source.id]: "yes" })[target.id].required, true)
  assert.equal(getQuestionRuntimeStates(form, { [source.id]: "yes" })[target.id].evidenceRequired, true)
  assert.equal(getQuestionRuntimeStates(form, { [source.id]: "no" })[target.id].visible, false)
})
test("multi-select answers validate arrays of stable choice ids", () => {
  const question = createQuestion("multi_select", "s")
  const firstChoice = question.config.choices![0]
  assert.equal(validateAnswer(question, [firstChoice.id]), undefined)
  assert.equal(validateAnswer(question, ["missing-choice"]), "Choose a valid option.")
})
test("form validation rejects inconsistent section membership and self conditions", () => {
  const form = emptyForm()
  const question = add(form)
  question.conditions.push({ id: "self", sourceQuestionId: question.id, operator: "equals", value: "x", targetQuestionId: question.id, effect: "hide" })
  assert.ok(validateForm(form).some((error) => error.message.includes("same question")))
  form.sections[0].questionIds = []
  assert.ok(validateForm(form).some((error) => error.message.includes("missing from its section")))
})
test("safe formula parser applies precedence, parentheses, and stable numeric references", async () => {
  const { evaluateFormula } = await import("./domain.ts")
  const question = createQuestion("integer", "s")
  assert.equal(evaluateFormula("({{" + question.id + "}} + 2) * 3", { [question.id]: 4 }, [question]), 18)
  assert.throws(() => evaluateFormula("1 / 0", {}, []), /zero/)
  assert.throws(() => evaluateFormula("1 + alert(1)", {}, []), /unsupported token/)
})
test("form validation detects calculated field dependency cycles", () => {
  const form = emptyForm()
  const first = add(form)
  const second = add(form)
  first.type = "calculated"
  first.config = { formula: `{{${second.id}}}`, dependencies: [second.id], precision: 2 }
  second.type = "calculated"
  second.config = { formula: `{{${first.id}}}`, dependencies: [first.id], precision: 2 }
  assert.ok(validateForm(form).some((error) => error.message.includes("circular dependencies")))
})
test("date and time conditions compare typed values chronologically", async () => {
  const { getQuestionRuntimeStates } = await import("./domain.ts")
  const form = emptyForm()
  const source = add(form)
  source.type = "time"
  const target = add(form)
  target.conditions = [{ id: "time-rule", sourceQuestionId: source.id, operator: "greater_than", value: "09:30", targetQuestionId: target.id, effect: "show" }]
  assert.equal(getQuestionRuntimeStates(form, { [source.id]: "10:15" })[target.id].visible, true)
  assert.equal(getQuestionRuntimeStates(form, { [source.id]: "09:00" })[target.id].visible, false)
  source.type = "date"
  target.conditions[0].value = "2026-04-01"
  assert.equal(getQuestionRuntimeStates(form, { [source.id]: "2026-04-02" })[target.id].visible, true)
})
test("boolean conditions preserve boolean values", async () => {
  const { getQuestionRuntimeStates } = await import("./domain.ts")
  const form = emptyForm()
  const source = add(form)
  source.type = "boolean"
  const target = add(form)
  target.conditions = [{ id: "boolean-rule", sourceQuestionId: source.id, operator: "equals", value: true, targetQuestionId: target.id, effect: "require" }]
  assert.equal(getQuestionRuntimeStates(form, { [source.id]: true })[target.id].required, true)
  assert.equal(getQuestionRuntimeStates(form, { [source.id]: false })[target.id].required, false)
})
test("repository preserves published snapshots and drafts direct edits", async () => {
  const { LocalFormRepository } = await import("./repository.ts")
  const stored = new Map<string, string>()
  const previousStorage = globalThis.localStorage
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => { stored.set(key, value) } } as Storage })
  try {
    const repository = new LocalFormRepository()
    const form = emptyForm()
    add(form)
    const draft = repository.save(form)
    const { publishedVersions: omittedHistory, ...snapshotDraft } = structuredClone(draft)
    const snapshot = { ...snapshotDraft, status: "Published" as const }
    const published = repository.save({ ...draft, status: "Published", publishedVersions: [{ id: "version_1", version: 1, publishedAt: "2026-01-01T00:00:00.000Z", snapshot }] })
    const changed = structuredClone(published)
    changed.title.en = "Changed without a new version"
    changed.publishedVersions[0].snapshot.title.en = "Mutated historical title"
    const saved = repository.save(changed)
    assert.equal(saved.status, "Draft")
    assert.equal(saved.publishedVersions[0].snapshot.title.en, "Untitled form")
    assert.equal(saved.publishedVersions.length, 1)
  } finally {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: previousStorage })
  }
})
test("local score derives from configured boolean pass values and weighted choices", async () => {
  const { calculateLocalScore } = await import("./domain.ts")
  const form = emptyForm()
  const boolean = add(form)
  boolean.type = "boolean"
  boolean.config = { passValue: true }
  boolean.scoring.weight = 2
  boolean.scoring.included = true
  const select = add(form, "short_text")
  select.type = "single_select"
  select.config = { choices: [{ id: "pass", label: { en: "Pass", ar: "ناجح" }, score: 10, finding: false }, { id: "fail", label: { en: "Fail", ar: "فشل" }, score: 0, finding: true }] }
  select.scoring.weight = 1
  assert.equal(calculateLocalScore(form, { [boolean.id]: true, [select.id]: "pass" }).score, 100)
  assert.equal(calculateLocalScore(form, { [boolean.id]: false, [select.id]: "fail" }).score, 0)
})
