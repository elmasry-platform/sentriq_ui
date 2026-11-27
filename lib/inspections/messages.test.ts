import test from "node:test"
import assert from "node:assert/strict"
import { purgedNotice, signOutWarning } from "./messages.ts"
test("sign out warning names the count in both languages", () => {
  assert.match(signOutWarning(1, "en"), /^1 inspection has not been sent/)
  assert.match(signOutWarning(3, "en"), /^3 inspections have not been sent/)
  assert.match(signOutWarning(2, "ar"), /2/)
})
test("purge notice names the days and says the draft is kept, EN and AR", () => {
  assert.equal(purgedNotice(14, "en"), "Queued answers older than 14 days were removed from this phone. Your draft is kept.")
  assert.match(purgedNotice(14, "ar"), /14/)
})
