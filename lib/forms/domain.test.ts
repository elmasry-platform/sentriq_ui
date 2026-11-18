import test from "node:test"
import assert from "node:assert/strict"
import { answerableCount, canAddAnswerable, createQuestion, duplicateForm, emptyForm, evaluateConditions, evaluateFormula, getQuestionRuntimeStates, calculateLocalScore, validateAnswer, validateForm, validateQuestion, FIELD_TYPES, type FormDefinition, type Question } from "./domain.ts"

const add = (form: ReturnType<typeof emptyForm>, type: Parameters<typeof createQuestion>[0] = "short_text") => {
  const question = createQuestion(type, form.sections[0].id)
  if (type === "repeat_group") question.config.children = [{ id: "child_a", type: "integer", label: { en: "Child", ar: "فرعي" }, required: false, config: {} }]
  form.questions.push(question)
  form.sections[0].questionIds.push(question.id)
  return question
}

// ─── Capacity ───────────────────────────────────────────────
test("instruction is zero capacity; normal and repeat fields count once", () => {
  const form = emptyForm()
  add(form)
  add(form, "instruction")
  add(form, "repeat_group")
  assert.equal(answerableCount(form), 2)
})

test("capacity allows 150 and rejects the next answerable field", () => {
  const form = emptyForm()
  for (let i = 0; i < 150; i++) add(form)
  assert.equal(answerableCount(form), 150)
  assert.equal(canAddAnswerable(form), false)
})

test("instructions can still be added at the 150 limit", () => {
  const form = emptyForm()
  for (let i = 0; i < 150; i++) add(form)
  assert.equal(canAddAnswerable(form), false)
  const instruction = createQuestion("instruction", form.sections[0].id)
  form.questions.push(instruction)
  form.sections[0].questionIds.push(instruction.id)
  assert.equal(answerableCount(form), 150)
})

test("repeat group children and repeated rows do not consume capacity", () => {
  const form = emptyForm()
  const rg = add(form, "repeat_group")
  rg.config.children = [
    { id: "c1", type: "short_text", label: { en: "A", ar: "أ" }, required: false, config: {} },
    { id: "c2", type: "decimal", label: { en: "B", ar: "ب" }, required: false, config: {} },
    { id: "c3", type: "integer", label: { en: "C", ar: "ج" }, required: false, config: {} },
  ]
  assert.equal(answerableCount(form), 1)
})

test("duplication rejects forms beyond the answerable-question limit", () => {
  const form = emptyForm()
  for (let index = 0; index < 151; index++) add(form)
  assert.throws(() => duplicateForm(form), /cannot exceed 150/)
})

// ─── Sections ───────────────────────────────────────────────
test("questions belong to the correct section", () => {
  const form = emptyForm()
  const section2: FormDefinition["sections"][number] = { id: "s2", title: { en: "S2", ar: "س٢" }, description: { en: "", ar: "" }, questionIds: [] }
  form.sections.push(section2)
  const q1 = createQuestion("short_text", form.sections[0].id)
  const q2 = createQuestion("short_text", section2.id)
  form.questions.push(q1, q2)
  form.sections[0].questionIds.push(q1.id)
  section2.questionIds.push(q2.id)
  assert.equal(form.questions[0].sectionId, form.sections[0].id)
  assert.equal(form.questions[1].sectionId, section2.id)
})

test("moving a question updates section references", () => {
  const form = emptyForm()
  const section2: FormDefinition["sections"][number] = { id: "s2", title: { en: "S2", ar: "س٢" }, description: { en: "", ar: "" }, questionIds: [] }
  form.sections.push(section2)
  const q = add(form)
  const source = form.sections[0]
  const target = section2
  source.questionIds = source.questionIds.filter((id) => id !== q.id)
  target.questionIds.push(q.id)
  q.sectionId = target.id
  assert.ok(target.questionIds.includes(q.id))
  assert.ok(!source.questionIds.includes(q.id))
  assert.equal(q.sectionId, target.id)
})

test("removing a section cannot leave orphan questions", () => {
  const form = emptyForm()
  const section2: FormDefinition["sections"][number] = { id: "s2", title: { en: "S2", ar: "س٢" }, description: { en: "", ar: "" }, questionIds: [] }
  form.sections.push(section2)
  const q = createQuestion("short_text", section2.id)
  form.questions.push(q)
  section2.questionIds.push(q.id)
  const destination = form.sections[0]
  destination.questionIds.push(...section2.questionIds)
  q.sectionId = destination.id
  form.sections = form.sections.filter((s) => s.id !== section2.id)
  assert.ok(destination.questionIds.includes(q.id))
  assert.equal(q.sectionId, destination.id)
  const errors = validateForm(form)
  assert.ok(!errors.some((e) => e.message.includes("orphan") || e.message.includes("missing from its section")))
})

test("form validation rejects inconsistent section membership", () => {
  const form = emptyForm()
  const q = add(form)
  form.sections[0].questionIds = []
  assert.ok(validateForm(form).some((error) => error.message.includes("missing from its section")))
})

// ─── All 23 field types validation ──────────────────────────
test("all 23 field types are defined and have default configs", () => {
  assert.equal(FIELD_TYPES.length, 23)
  for (const type of FIELD_TYPES) {
    const q = createQuestion(type, "s")
    assert.ok(q.config, `${type} should have a config`)
  }
})

test("short_text validates minimum and maximum length", () => {
  const q = createQuestion("short_text", "s")
  q.config = { placeholder: "", minLength: 5, maxLength: 10 }
  assert.equal(validateAnswer(q, "hi"), "Minimum length is 5.")
  assert.equal(validateAnswer(q, "this is way too long"), "Maximum length is 10.")
  assert.equal(validateAnswer(q, "valid"), undefined)
})

test("long_text validates maximum length", () => {
  const q = createQuestion("long_text", "s")
  q.config = { placeholder: "", maxLength: 20 }
  assert.equal(validateAnswer(q, "x".repeat(21)), "Maximum length is 20.")
  assert.equal(validateAnswer(q, "short enough"), undefined)
})

test("integer accepts zero and rejects fractional values", () => {
  const q = createQuestion("integer", "s")
  assert.equal(validateAnswer(q, 0), undefined)
  assert.equal(validateAnswer(q, 1.5), "Enter a whole number.")
})

test("integer enforces min and max bounds", () => {
  const q = createQuestion("integer", "s")
  q.config = { min: 10, max: 20 }
  assert.equal(validateAnswer(q, 5), "Enter a number within the configured bounds.")
  assert.equal(validateAnswer(q, 25), "Enter a number within the configured bounds.")
  assert.equal(validateAnswer(q, 15), undefined)
})

test("decimal validates precision and bounds", () => {
  const q = createQuestion("decimal", "s")
  q.config = { min: 0, max: 100, precision: 2, unit: "kg" }
  assert.equal(validateAnswer(q, 50.123), "Number exceeds the configured decimal precision.")
  assert.equal(validateAnswer(q, 50.12), undefined)
  assert.equal(validateAnswer(q, -1), "Enter a number within the configured bounds.")
})

test("date validates range", () => {
  const q = createQuestion("date", "s")
  q.config = { minDate: "2026-01-01", maxDate: "2026-12-31" }
  assert.equal(validateAnswer(q, "2025-06-01"), "Date is outside the configured range.")
  assert.equal(validateAnswer(q, "2026-06-15"), undefined)
})

test("time validates 24-hour format", () => {
  const q = createQuestion("time", "s")
  assert.equal(validateAnswer(q, "10:30"), undefined)
  assert.equal(validateAnswer(q, "25:00"), "Enter a valid time in 24-hour format.")
})

test("boolean requires a boolean answer", () => {
  const q = createQuestion("boolean", "s")
  assert.equal(validateAnswer(q, true), undefined)
  assert.equal(validateAnswer(q, false), undefined)
  assert.equal(validateAnswer(q, "yes"), "Choose yes or no.")
})

test("single_select validates a single stable choice id", () => {
  const q = createQuestion("single_select", "s")
  const firstChoice = q.config.choices![0]
  assert.equal(validateAnswer(q, firstChoice.id), undefined)
  assert.equal(validateAnswer(q, ["missing"]), "Choose a valid option.")
})

test("multi-select validates arrays of stable choice ids", () => {
  const q = createQuestion("multi_select", "s")
  const firstChoice = q.config.choices![0]
  const secondChoice = q.config.choices![1]
  assert.equal(validateAnswer(q, [firstChoice.id]), undefined)
  assert.equal(validateAnswer(q, [firstChoice.id, secondChoice.id]), undefined)
  assert.equal(validateAnswer(q, ["missing-choice"]), "Choose a valid option.")
})

test("reference, user, and site accept demo selections", () => {
  const ref = createQuestion("reference", "s")
  assert.equal(validateAnswer(ref, "Demo record 1"), undefined)
  const user = createQuestion("user", "s")
  assert.equal(validateAnswer(user, "Demo user · Mariam Hassan"), undefined)
  const site = createQuestion("site", "s")
  assert.equal(validateAnswer(site, "Demo site · Central facility"), undefined)
})

test("location accepts textual input", () => {
  const q = createQuestion("location", "s")
  assert.equal(validateAnswer(q, "Building 3, Floor 2"), undefined)
})

test("photo validates file count and types", () => {
  const q = createQuestion("photo", "s")
  q.config = { maxBytes: 1048576, maxFiles: 2, mimeTypes: ["image/jpeg"], preview: true }
  const file = (name: string, size: number, type: string) => ({ name, size, type, lastModified: 0 } as unknown as File)
  assert.equal(validateAnswer(q, [file("a.jpg", 100, "image/jpeg")]), undefined)
  assert.equal(validateAnswer(q, [file("a.jpg", 100, "image/jpeg"), file("b.jpg", 100, "image/jpeg"), file("c.jpg", 100, "image/jpeg")]), "Choose no more than 2 files.")
  assert.equal(validateAnswer(q, [file("a.txt", 100, "text/plain")]), "A selected file has an unsupported type.")
})

test("file validates file count and types", () => {
  const q = createQuestion("file", "s")
  q.config = { maxBytes: 1048576, maxFiles: 1, mimeTypes: ["application/pdf"] }
  const pdf = (name: string) => ({ name, size: 100, type: "application/pdf", lastModified: 0 } as unknown as File)
  assert.equal(validateAnswer(q, [pdf("a.pdf")]), undefined)
  assert.equal(validateAnswer(q, [{ name: "a.jpg", size: 100, type: "image/jpeg", lastModified: 0 } as unknown as File]), "A selected file has an unsupported type.")
})

test("attestation requires explicit acknowledgment", () => {
  const q = createQuestion("attestation", "s")
  assert.equal(validateAnswer(q, false), "Acknowledgment is required.")
  assert.equal(validateAnswer(q, true), undefined)
})

test("signature accepts text input in demo mode", () => {
  const q = createQuestion("signature", "s")
  assert.equal(validateAnswer(q, "J. Smith"), undefined)
})

test("instruction has no answer control and is always valid", () => {
  const q = createQuestion("instruction", "s")
  assert.equal(validateAnswer(q, ""), undefined)
  assert.equal(answerableCount({ questions: [q] }), 0)
})

test("gps validates coordinate ranges", () => {
  const q = createQuestion("gps", "s")
  assert.equal(validateAnswer(q, "40.7128, -74.0060"), undefined)
  assert.equal(validateAnswer(q, "100, 200"), "Enter latitude (−90 to 90) and longitude (−180 to 180).")
})

test("barcode_qr validates pattern and maximum length", () => {
  const q = createQuestion("barcode_qr", "s")
  q.config = { pattern: "^[A-Z0-9]+$", maxLength: 10, manualEntry: true }
  assert.equal(validateAnswer(q, "ABC123"), undefined)
  assert.equal(validateAnswer(q, "abc"), "Code does not match the configured pattern.")
  assert.equal(validateAnswer(q, "ABCDEFGHIJK"), "Code is longer than the configured maximum.")
})

test("calculated field validates formula references", () => {
  const form = emptyForm()
  const num = add(form, "integer")
  const calc = add(form, "calculated")
  calc.config = { formula: `{{${num.id}}} + 5`, dependencies: [num.id], precision: 2 }
  const errors = validateForm(form)
  assert.ok(!errors.some((e) => e.message.includes("unknown question")))
})

test("repeat_group validates row limits and child fields", () => {
  const q = createQuestion("repeat_group", "s")
  q.config = { minRows: 1, maxRows: 3, children: [{ id: "c1", type: "short_text", label: { en: "Name", ar: "اسم" }, required: true, config: {} }] }
  assert.equal(validateAnswer(q, []), "Row count is outside the configured range.")
  assert.equal(validateAnswer(q, [{ c1: "A" }, { c1: "B" }, { c1: "C" }, { c1: "D" }]), "Row count is outside the configured range.")
  assert.equal(validateAnswer(q, [{ c1: "" }]), "Row 1: Name is required.")
  assert.equal(validateAnswer(q, [{ c1: "Valid" }]), undefined)
})

test("repeat_group config requires at least one child", () => {
  const q = createQuestion("repeat_group", "s")
  q.config = { minRows: 0, maxRows: 5, children: [] }
  assert.ok(validateQuestion(q).some((e) => e.includes("at least one child")))
})

test("repeat_group child field decimal type is supported", () => {
  const q = createQuestion("repeat_group", "s")
  q.config = { minRows: 0, maxRows: 5, children: [{ id: "c1", type: "decimal", label: { en: "Weight", ar: "وزن" }, required: false, config: {} }] }
  assert.equal(validateQuestion(q).length, 0)
})

// ─── Conditions ─────────────────────────────────────────────
test("condition effects control visibility, required state, and evidence", () => {
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

test("hide effect hides the target when condition matches", () => {
  const form = emptyForm()
  const source = add(form)
  const target = add(form)
  target.conditions = [{ id: "hide-rule", sourceQuestionId: source.id, operator: "equals", value: "hide-me", targetQuestionId: target.id, effect: "hide" }]
  assert.equal(getQuestionRuntimeStates(form, { [source.id]: "hide-me" })[target.id].visible, false)
  assert.equal(getQuestionRuntimeStates(form, { [source.id]: "show-me" })[target.id].visible, true)
})

test("dynamic required via condition", () => {
  const form = emptyForm()
  const source = add(form)
  const target = add(form)
  target.conditions = [{ id: "req-rule", sourceQuestionId: source.id, operator: "equals", value: "urgent", targetQuestionId: target.id, effect: "require" }]
  assert.equal(getQuestionRuntimeStates(form, { [source.id]: "normal" })[target.id].required, false)
  assert.equal(getQuestionRuntimeStates(form, { [source.id]: "urgent" })[target.id].required, true)
})

test("require_evidence communicates evidence requirement", () => {
  const form = emptyForm()
  const source = add(form)
  const target = add(form)
  target.conditions = [{ id: "ev-rule", sourceQuestionId: source.id, operator: "equals", value: "critical", targetQuestionId: target.id, effect: "require_evidence" }]
  assert.equal(getQuestionRuntimeStates(form, { [source.id]: "low" })[target.id].evidenceRequired, false)
  assert.equal(getQuestionRuntimeStates(form, { [source.id]: "critical" })[target.id].evidenceRequired, true)
})

test("contains operator works with multi-select arrays", () => {
  const form = emptyForm()
  const source = add(form, "multi_select")
  const target = add(form)
  target.conditions = [{ id: "contains-rule", sourceQuestionId: source.id, operator: "contains", value: source.config.choices![0].id, targetQuestionId: target.id, effect: "show" }]
  assert.equal(getQuestionRuntimeStates(form, { [source.id]: [source.config.choices![0].id] })[target.id].visible, true)
  assert.equal(getQuestionRuntimeStates(form, { [source.id]: [source.config.choices![1].id] })[target.id].visible, false)
})

test("form validation rejects self-referencing conditions", () => {
  const form = emptyForm()
  const q = add(form)
  q.conditions.push({ id: "self", sourceQuestionId: q.id, operator: "equals", value: "x", targetQuestionId: q.id, effect: "hide" })
  assert.ok(validateForm(form).some((error) => error.message.includes("same question")))
})

test("form validation rejects conditions referencing deleted questions", () => {
  const form = emptyForm()
  const source = add(form)
  const target = add(form)
  target.conditions = [{ id: "dangling", sourceQuestionId: "deleted-id", operator: "equals", value: "x", targetQuestionId: target.id, effect: "show" }]
  assert.ok(validateForm(form).some((error) => error.message.includes("no longer exists")))
})

test("type-incompatible operators are rejected", () => {
  const form = emptyForm()
  const source = add(form, "short_text")
  const target = add(form)
  target.conditions = [{ id: "bad-op", sourceQuestionId: source.id, operator: "greater_than", value: "5", targetQuestionId: target.id, effect: "show" }]
  assert.ok(validateForm(form).some((error) => error.message.includes("Comparison requires")))
})

test("multiple conditions on one target with show + hide", () => {
  const form = emptyForm()
  const s1 = add(form)
  const s2 = add(form)
  const target = add(form)
  target.conditions = [
    { id: "r1", sourceQuestionId: s1.id, operator: "equals", value: "show", targetQuestionId: target.id, effect: "show" },
    { id: "r2", sourceQuestionId: s2.id, operator: "equals", value: "hide", targetQuestionId: target.id, effect: "hide" },
  ]
  const states = getQuestionRuntimeStates(form, { [s1.id]: "show", [s2.id]: "hide" })
  assert.equal(states[target.id].visible, false)
  const states2 = getQuestionRuntimeStates(form, { [s1.id]: "show", [s2.id]: "no" })
  assert.equal(states2[target.id].visible, true)
})

test("is_empty and is_not_empty operators work", () => {
  const form = emptyForm()
  const source = add(form)
  const target = add(form)
  target.conditions = [{ id: "empty-rule", sourceQuestionId: source.id, operator: "is_empty", value: "", targetQuestionId: target.id, effect: "show" }]
  assert.equal(getQuestionRuntimeStates(form, { [source.id]: "" })[target.id].visible, true)
  assert.equal(getQuestionRuntimeStates(form, { [source.id]: "filled" })[target.id].visible, false)
})

test("date and time conditions compare typed values chronologically", () => {
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

test("boolean conditions preserve boolean values", () => {
  const form = emptyForm()
  const source = add(form)
  source.type = "boolean"
  const target = add(form)
  target.conditions = [{ id: "boolean-rule", sourceQuestionId: source.id, operator: "equals", value: true, targetQuestionId: target.id, effect: "require" }]
  assert.equal(getQuestionRuntimeStates(form, { [source.id]: true })[target.id].required, true)
  assert.equal(getQuestionRuntimeStates(form, { [source.id]: false })[target.id].required, false)
})

test("evaluateConditions returns a set of visible question ids", () => {
  const form = emptyForm()
  const source = add(form)
  const target = add(form)
  target.conditions = [{ id: "show-rule", sourceQuestionId: source.id, operator: "equals", value: "yes", targetQuestionId: target.id, effect: "show" }]
  const visible = evaluateConditions(form, { [source.id]: "no" })
  assert.ok(visible.has(source.id))
  assert.ok(!visible.has(target.id))
  const visible2 = evaluateConditions(form, { [source.id]: "yes" })
  assert.ok(visible2.has(target.id))
})

// ─── Calculations ───────────────────────────────────────────
test("safe formula parser applies precedence, parentheses, and stable numeric references", () => {
  const question = createQuestion("integer", "s")
  assert.equal(evaluateFormula(`({{${question.id}}} + 2) * 3`, { [question.id]: 4 }, [question]), 18)
  assert.equal(evaluateFormula("2 + 3 * 4", {}, []), 14)
  assert.equal(evaluateFormula("(2 + 3) * 4", {}, []), 20)
  assert.equal(evaluateFormula("10 - 2 - 3", {}, []), 5)
  assert.equal(evaluateFormula("100 / 4 / 5", {}, []), 5)
})

test("formula rejects division by zero", () => {
  assert.throws(() => evaluateFormula("1 / 0", {}, []), /zero/)
})

test("formula rejects unsupported tokens (no code execution)", () => {
  assert.throws(() => evaluateFormula("1 + alert(1)", {}, []), /unsupported token/)
})

test("formula rejects unknown question references", () => {
  assert.throws(() => evaluateFormula("{{unknown_id}} + 1", {}, []), /Unknown question reference/)
})

test("formula rejects non-numeric question references", () => {
  const q = createQuestion("short_text", "s")
  assert.throws(() => evaluateFormula(`{{${q.id}}} + 1`, { [q.id]: "text" }, [q]), /numeric questions/)
})

test("formula rejects incomplete expressions", () => {
  assert.throws(() => evaluateFormula("1 +", {}, []), /incomplete or invalid/)
  assert.throws(() => evaluateFormula("(1 + 2", {}, []), /parentheses/)
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

test("form validation rejects formula referencing non-numeric questions", () => {
  const form = emptyForm()
  const text = add(form, "short_text")
  const calc = add(form, "calculated")
  calc.config = { formula: `{{${text.id}}}`, dependencies: [text.id], precision: 2 }
  assert.ok(validateForm(form).some((error) => error.message.includes("not numeric")))
})

// ─── Scoring ────────────────────────────────────────────────
test("local score derives from configured boolean pass values and weighted choices", () => {
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

test("scoring with 'answered' denominator excludes unanswered questions", () => {
  const form = emptyForm()
  const boolean = add(form)
  boolean.type = "boolean"
  boolean.config = { passValue: true }
  boolean.scoring.weight = 1
  boolean.scoring.included = true
  boolean.scoring.denominator = "answered"
  const result = calculateLocalScore(form, {})
  assert.equal(result.score, null)
  assert.equal(result.answered, 0)
})

test("scoring with 'all' denominator includes all questions", () => {
  const form = emptyForm()
  const boolean = add(form)
  boolean.type = "boolean"
  boolean.config = { passValue: true }
  boolean.scoring.weight = 1
  boolean.scoring.included = true
  boolean.scoring.denominator = "all"
  const result = calculateLocalScore(form, { [boolean.id]: true })
  assert.equal(result.score, 100)
})

test("instruction and calculated fields are excluded from scoring", () => {
  const form = emptyForm()
  const instruction = add(form, "instruction")
  instruction.scoring.included = true
  const calc = add(form, "calculated")
  calc.scoring.included = true
  const result = calculateLocalScore(form, {})
  assert.equal(result.score, null)
})

// ─── Duplication ────────────────────────────────────────────
test("duplication remaps stable ids, creates draft, and excludes published snapshots", () => {
  const form = emptyForm()
  const source = add(form)
  const target = add(form)
  target.conditions.push({ id: "r1", sourceQuestionId: source.id, operator: "equals", value: "yes", targetQuestionId: target.id, effect: "show" })
  const copy = duplicateForm(form)
  assert.notEqual(copy.id, form.id)
  assert.notEqual(copy.questions[0].id, source.id)
  assert.equal(copy.questions[1].conditions[0].sourceQuestionId, copy.questions[0].id)
  assert.equal(copy.questions[1].conditions[0].targetQuestionId, copy.questions[1].id)
  assert.equal(copy.status, "Draft")
  assert.equal(copy.publishedVersions.length, 0)
})

test("duplication creates new ids for sections and choices", () => {
  const form = emptyForm()
  const select = add(form, "single_select")
  const originalChoiceId = select.config.choices![0].id
  const copy = duplicateForm(form)
  const copiedSelect = copy.questions[0]
  assert.notEqual(copiedSelect.config.choices![0].id, originalChoiceId)
  assert.notEqual(copy.sections[0].id, form.sections[0].id)
})

test("duplication remaps calculated field formula references", () => {
  const form = emptyForm()
  const num = add(form, "integer")
  const calc = add(form, "calculated")
  calc.config = { formula: `{{${num.id}}} * 2`, dependencies: [num.id], precision: 2 }
  const copy = duplicateForm(form)
  const copiedNum = copy.questions[0]
  const copiedCalc = copy.questions[1]
  assert.ok(String(copiedCalc.config.formula).includes(`{{${copiedNum.id}}}`))
  assert.ok(copiedCalc.config.dependencies?.includes(copiedNum.id))
})

test("duplication does not share mutable nested objects", () => {
  const form = emptyForm()
  const select = add(form, "single_select")
  const copy = duplicateForm(form)
  copy.questions[0].config.choices![0].label.en = "Modified"
  assert.notEqual(form.questions[0].config.choices![0].label.en, "Modified")
})

test("duplication creates new ids for repeat group children", () => {
  const form = emptyForm()
  const rg = add(form, "repeat_group")
  rg.config.children = [{ id: "child_a", type: "short_text", label: { en: "A", ar: "أ" }, required: false, config: {} }]
  const copy = duplicateForm(form)
  assert.notEqual((copy.questions[0].config.children as { id: string }[])[0].id, "child_a")
})

// ─── Repository and publishing ──────────────────────────────
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

test("repository create, save, reopen, edit, duplicate, archive, restore", async () => {
  const { LocalFormRepository } = await import("./repository.ts")
  const stored = new Map<string, string>()
  const previousStorage = globalThis.localStorage
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => { stored.set(key, value) } } as Storage })
  try {
    const repository = new LocalFormRepository()
    const form = emptyForm()
    form.title.en = "Test form"
    add(form, "short_text")
    const saved = repository.save(form)
    assert.ok(saved.id)
    const reopened = repository.get(saved.id)
    assert.ok(reopened)
    assert.equal(reopened!.title.en, "Test form")
    assert.equal(reopened!.questions.length, 1)
    reopened!.title.en = "Edited title"
    reopened!.questions[0].title.en = "Edited question"
    const savedAgain = repository.save(reopened!)
    const reopened2 = repository.get(savedAgain.id)
    assert.equal(reopened2!.title.en, "Edited title")
    assert.equal(reopened2!.questions[0].title.en, "Edited question")
    const duplicated = repository.duplicate(savedAgain.id)
    assert.ok(duplicated)
    assert.notEqual(duplicated!.id, savedAgain.id)
    assert.equal(duplicated!.status, "Draft")
    assert.equal(duplicated!.questions.length, 1)
    repository.setStatus(savedAgain.id, "Archived")
    assert.equal(repository.get(savedAgain.id)!.status, "Archived")
    repository.setStatus(savedAgain.id, "Draft")
    assert.equal(repository.get(savedAgain.id)!.status, "Draft")
    const all = repository.list()
    assert.ok(all.length >= 2)
  } finally {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: previousStorage })
  }
})

test("repository save does not overwrite newer state on failure", async () => {
  const { LocalFormRepository } = await import("./repository.ts")
  const stored = new Map<string, string>()
  const previousStorage = globalThis.localStorage
  let shouldFail = false
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => { if (shouldFail) throw new Error("Storage full"); stored.set(key, value) } } as Storage })
  try {
    const repository = new LocalFormRepository()
    const form = emptyForm()
    form.title.en = "Original"
    add(form)
    const saved = repository.save(form)
    shouldFail = true
    saved.title.en = "Should not save"
    assert.throws(() => repository.save(saved), /could not be saved/)
    shouldFail = false
    const unchanged = repository.get(saved.id)
    assert.equal(unchanged!.title.en, "Original")
  } finally {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: previousStorage })
  }
})

test("repository handles corrupted storage safely", async () => {
  const { LocalFormRepository } = await import("./repository.ts")
  const previousStorage = globalThis.localStorage
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "{ invalid json", setItem: () => {} } as unknown as Storage })
  try {
    const repository = new LocalFormRepository()
    assert.throws(() => repository.list(), /could not be read/)
  } finally {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: previousStorage })
  }
})

test("repository duplicate does not share mutable state with original", async () => {
  const { LocalFormRepository } = await import("./repository.ts")
  const stored = new Map<string, string>()
  const previousStorage = globalThis.localStorage
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => { stored.set(key, value) } } as Storage })
  try {
    const repository = new LocalFormRepository()
    const form = emptyForm()
    add(form, "single_select")
    const saved = repository.save(form)
    const dup = repository.duplicate(saved.id)
    dup!.questions[0].config.choices![0].label.en = "Changed in duplicate"
    const original = repository.get(saved.id)
    assert.notEqual(original!.questions[0].config.choices![0].label.en, "Changed in duplicate")
  } finally {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: previousStorage })
  }
})

test("publish validation blocks empty form", () => {
  assert.ok(validateForm(emptyForm()).some((item) => item.message.includes("at least one")))
})

test("publish validation blocks form over 150 answerable questions", () => {
  const form = emptyForm()
  for (let i = 0; i < 151; i++) add(form)
  assert.ok(validateForm(form).some((item) => item.message.includes("cannot exceed 150")))
})
