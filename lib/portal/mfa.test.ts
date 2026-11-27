import { test } from "node:test"
import assert from "node:assert/strict"
import { cleanCode, isValidCode, mfaEnabled, mfaErrorKey, mfaRequired, mfaStep } from "./mfa.ts"

test("flag is off unless exactly on", () => {
  for (const v of [undefined, "", "off", "true", "1", "ON"]) assert.equal(mfaEnabled(v), false)
  assert.equal(mfaEnabled("on"), true)
})
test("only Owner and Sub-owner, only when the flag is on", () => {
  assert.equal(mfaRequired("owner", "on"), true)
  assert.equal(mfaRequired("subowner", "on"), true)
  for (const r of ["superadmin", "admin", "employee", undefined] as const) assert.equal(mfaRequired(r, "on"), false)
  assert.equal(mfaRequired("owner", undefined), false)
  assert.equal(mfaRequired("owner", "off"), false)
})
test("step: aal1 without a factor enrols, with a factor asks for the code, aal2 passes", () => {
  assert.equal(mfaStep({ currentLevel: "aal1", nextLevel: "aal1" }, false), "enroll")
  assert.equal(mfaStep({ currentLevel: "aal1", nextLevel: "aal2" }, true), "challenge")
  assert.equal(mfaStep({ currentLevel: "aal1", nextLevel: "aal2" }, false), "challenge")
  assert.equal(mfaStep({ currentLevel: "aal1", nextLevel: "aal1" }, true), "challenge")
  assert.equal(mfaStep({ currentLevel: "aal2", nextLevel: "aal2" }, true), "ok")
  assert.equal(mfaStep({ currentLevel: null, nextLevel: null }, false), "enroll")
})
test("code input keeps digits only, max 6", () => {
  assert.equal(cleanCode("12 34-56 78"), "123456")
  assert.equal(cleanCode("abc"), "")
  assert.equal(isValidCode("123456"), true)
  for (const v of ["12345", "1234567", "12345a", ""]) assert.equal(isValidCode(v), false)
})
test("wrong code maps to the invalid copy, anything else to generic", () => {
  assert.equal(mfaErrorKey({ code: "mfa_verification_failed", message: "x" }), "mfa.err.invalid")
  assert.equal(mfaErrorKey({ message: "Invalid TOTP code entered" }), "mfa.err.invalid")
  assert.equal(mfaErrorKey({ message: "network down" }), "mfa.err.generic")
  assert.equal(mfaErrorKey(null), "mfa.err.generic")
})
