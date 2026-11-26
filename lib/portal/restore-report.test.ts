import test from "node:test"
import assert from "node:assert/strict"
import { latestRestore, restoreLines } from "./restore-report.ts"

test("only non-zero counts become lines, in a fixed order", () => {
  assert.deepEqual(restoreLines({ decisions_restored: 3, profiles_restored: 0, rows_not_restored: 2 }), [
    { key: "restore.decisions", count: 3 },
    { key: "restore.notRestored", count: 2 },
  ])
})
test("an empty report gives no lines", () => {
  assert.deepEqual(restoreLines({}), [])
})
test("detail keys are listed and the newest row is the first one", () => {
  assert.deepEqual(restoreLines({ not_restored_invalid_role_or_source: 1, restore_failed: 2 }), [
    { key: "restore.invalid", count: 1 },
    { key: "restore.failed", count: 2 },
  ])
  assert.equal(latestRestore([{ snapshot_id: "a" }, { snapshot_id: "b" }])?.snapshot_id, "a")
  assert.equal(latestRestore({ rows: [] }), null)
  assert.equal(latestRestore(null), null)
})
