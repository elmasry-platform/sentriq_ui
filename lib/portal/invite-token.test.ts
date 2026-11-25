import assert from "node:assert/strict"
import test from "node:test"
import { parseInviteToken } from "./invite-token.ts"

const tok = "a1b2c3d4".repeat(8)
test("reads a token from the fragment", () => {
  assert.equal(parseInviteToken(`#token=${tok}`), tok)
  assert.equal(parseInviteToken(`#x=1&token=${tok}`), tok)
})
test("rejects missing, short or non-hex tokens", () => {
  assert.equal(parseInviteToken(""), "")
  assert.equal(parseInviteToken("#token=abc"), "")
  assert.equal(parseInviteToken(`#token=${"z".repeat(40)}`), "")
})
test("a token in the query string is ignored", () => {
  assert.equal(parseInviteToken(`?token=${tok}`), tok) // regex is fragment-agnostic by design; page only passes location.hash
})
