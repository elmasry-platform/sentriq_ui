import assert from "node:assert/strict"
import test from "node:test"
import { friendlyError } from "./errors.ts"

test("known codes map to readable copy", () => {
  assert.match(friendlyError("request_failed_401"), /session has expired/i)
  assert.match(friendlyError("membership_not_found"), /no longer exists/i)
})
test("unknown not_authorized codes read as a withdrawn power", () => {
  assert.match(friendlyError("some_new_thing_not_authorized"), /withdrawn/i)
})
test("raw snake_case never reaches a person", () => {
  assert.equal(friendlyError("weird_internal_code"), "Something went wrong. Try again.")
  assert.equal(friendlyError("weird_internal_code", "Custom"), "Custom")
})
test("empty and non-error input use the fallback; plain sentences pass through", () => {
  assert.equal(friendlyError(undefined), "Something went wrong. Try again.")
  assert.equal(friendlyError(new Error("Name is too short.")), "Name is too short.")
})
