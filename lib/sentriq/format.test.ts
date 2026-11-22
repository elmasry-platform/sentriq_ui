import test from "node:test"
import assert from "node:assert/strict"
import { errorMessage, formatNumber, plural, stageLabel } from "./format.ts"
import { words } from "./inspections-i18n.ts"

test("English plurals", () => {
  assert.equal(plural("en", "finding", 1), "1 finding")
  assert.equal(plural("en", "finding", 2), "2 findings")
  assert.equal(plural("en", "action", 0), "0 actions")
})
test("Arabic plurals use all six categories", () => {
  assert.equal(plural("ar", "finding", 0), "لا ملاحظات")
  assert.equal(plural("ar", "finding", 1), "ملاحظة واحدة")
  assert.equal(plural("ar", "finding", 2), "ملاحظتان")
  assert.equal(plural("ar", "finding", 3), `${formatNumber(3, "ar")} ملاحظات`)
  assert.equal(plural("ar", "finding", 11), `${formatNumber(11, "ar")} ملاحظة`)
  assert.equal(plural("ar", "day", 100), `${formatNumber(100, "ar")} يوم`)
})
test("stage labels are translated and unknown stages fall back readably", () => {
  assert.equal(stageLabel("en", "reviewer_2"), "Reviewer 2")
  assert.equal(stageLabel("ar", "final_reviewer"), "المراجع النهائي")
  assert.equal(stageLabel("en", null), "—")
})
test("repository error codes map to translated messages", () => {
  assert.match(errorMessage("en", { code: "STALE_REVISION" }), /changed by someone else/)
  assert.match(errorMessage("ar", { code: "SELF_REVIEW" }), /[ء-ي]/)
  assert.match(errorMessage("en", new Error("boom")), /try again/i)
})
test("English and Arabic dictionaries have identical keys", () => {
  const en = Object.keys(words.en).sort(), ar = Object.keys(words.ar).sort()
  assert.deepEqual(en.filter((key) => !ar.includes(key)), [])
  assert.deepEqual(ar.filter((key) => !en.includes(key)), [])
})
