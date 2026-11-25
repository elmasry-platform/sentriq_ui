import assert from "node:assert/strict"
import test from "node:test"
import { COPY } from "./copy.ts"
import { permissionLabel } from "./perm-label.ts"

const look = (lang: "en" | "ar") => (k: string) => (COPY[lang] as Record<string, string>)[k] ?? null
test("hand-written label wins", () => {
  assert.equal(permissionLabel("hse.forms.read", look("en")), "View forms")
})
test("generic labels for unlabelled keys, EN and AR", () => {
  assert.equal(permissionLabel("operations.contractors.create_edit", look("en")), "Create and edit contractors")
  assert.equal(permissionLabel("operations.engagements.export", look("en")), "Export engagements")
  assert.equal(permissionLabel("operations.engagements.export", look("ar")), "تصدير التعاقدات")
})
test("never returns snake_case", () => {
  assert.ok(!/_/.test(permissionLabel("x.some_thing.do_it", look("en"))))
})
