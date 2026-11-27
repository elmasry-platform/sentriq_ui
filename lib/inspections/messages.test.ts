import test from "node:test"
import assert from "node:assert/strict"
import { signOutWarning } from "./messages.ts"
test("sign out warning names the count in both languages", () => {
  assert.match(signOutWarning(1, "en"), /^1 inspection has not been sent/)
  assert.match(signOutWarning(3, "en"), /^3 inspections have not been sent/)
  assert.match(signOutWarning(2, "ar"), /2/)
})
