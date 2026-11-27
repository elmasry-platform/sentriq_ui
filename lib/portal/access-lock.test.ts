import assert from "node:assert/strict"
import test from "node:test"
import { COPY } from "./copy.ts"
import { isReadOnlyTarget } from "./access-lock.ts"

test("a company Superadmin sees another Superadmin read-only", () => {
  assert.equal(isReadOnlyTarget(true, "company_superadmin"), true)
})
test("other targets and operators stay editable", () => {
  assert.equal(isReadOnlyTarget(true, "company_admin"), false)
  assert.equal(isReadOnlyTarget(true, "employee"), false)
  assert.equal(isReadOnlyTarget(false, "company_superadmin"), false)
})
test("the lock note exists in EN and AR", () => {
  assert.equal((COPY.en as Record<string, string>)["ea.managedByOperator"], "Managed by a platform operator")
  assert.match((COPY.ar as Record<string, string>)["ea.managedByOperator"], /[\u0600-\u06FF]/)
})
