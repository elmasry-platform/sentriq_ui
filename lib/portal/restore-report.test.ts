import test from "node:test"
import assert from "node:assert/strict"
import { restoreLines } from "./restore-report.ts"

test("only non-zero counts become lines, in a fixed order", () => {
  assert.deepEqual(restoreLines({ decisions_restored: 3, profiles_restored: 0, rows_not_restored: 2 }), [
    { key: "restore.decisions", count: 3 },
    { key: "restore.notRestored", count: 2 },
  ])
})
test("an empty report gives no lines", () => {
  assert.deepEqual(restoreLines({}), [])
})
