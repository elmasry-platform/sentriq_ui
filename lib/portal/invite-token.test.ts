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
test("a token after ? is also read (the page only passes location.hash)", () => {
  assert.equal(parseInviteToken(`?token=${tok}`), tok)
})
test("a longer key that ends in token= is not matched", () => {
  assert.equal(parseInviteToken(`#notoken=${tok}`), "")
  assert.equal(parseInviteToken(`#a=1&token=${tok}`), tok)
})
