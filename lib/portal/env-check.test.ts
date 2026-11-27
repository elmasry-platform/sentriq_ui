import test from "node:test"
import assert from "node:assert/strict"
// @ts-ignore plain module shared with next.config.mjs
import { assertPublicEnv, missingPublicEnv } from "./env-check.mjs"

const full = {
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  NEXT_PUBLIC_BACKEND_URL: "https://api.example",
}

test("a complete environment passes", () => {
  assert.deepEqual(missingPublicEnv(full), [])
  assert.doesNotThrow(() => assertPublicEnv(full))
})

test("each missing or blank variable fails the build and is named", () => {
  assert.throws(() => assertPublicEnv({}), /NEXT_PUBLIC_SUPABASE_URL.*NEXT_PUBLIC_SUPABASE_ANON_KEY.*NEXT_PUBLIC_BACKEND_URL/)
  assert.throws(() => assertPublicEnv({ ...full, NEXT_PUBLIC_BACKEND_URL: "  " }), /NEXT_PUBLIC_BACKEND_URL/)
})
