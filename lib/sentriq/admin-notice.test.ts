import assert from "node:assert/strict"
import test from "node:test"
import { PREVIEW_ONLY_NOTICE } from "./admin-notice.ts"

test("preview notice exists in EN and AR", () => {
  assert.equal(PREVIEW_ONLY_NOTICE.en, "Preview only, not saved to the server")
  assert.match(PREVIEW_ONLY_NOTICE.ar, /[\u0600-\u06FF]/)
})
