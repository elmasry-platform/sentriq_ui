import { test } from "node:test"
import assert from "node:assert/strict"
import { bestMembership, levelRank } from "./membership-rank.ts"

test("superadmin in A beats employee in B, whatever the order", () => {
  const a = { role: "company_superadmin", workspaceId: "A" }
  const b = { role: "employee", workspaceId: "B" }
  assert.equal(bestMembership([b, a])?.workspaceId, "A")
  assert.equal(bestMembership([a, b])?.workspaceId, "A")
})
test("admin beats employee, superadmin beats admin", () => {
  const rows = [{ role: "employee", w: 1 }, { role: "company_admin", w: 2 }, { role: "company_superadmin", w: 3 }]
  assert.equal(bestMembership(rows)?.w, 3)
  assert.equal(bestMembership(rows.slice(0, 2))?.w, 2)
})
test("ties keep the first row; unknown level ranks last; empty is undefined", () => {
  assert.equal(bestMembership([{ role: "employee", w: 1 }, { role: "employee", w: 2 }])?.w, 1)
  assert.equal(bestMembership([{ role: "weird", w: 1 }, { role: "employee", w: 2 }])?.w, 2)
  assert.equal(levelRank("weird"), 0)
  assert.equal(bestMembership([]), undefined)
})
test("does not mutate the input", () => {
  const rows = [{ role: "employee" }, { role: "company_superadmin" }]
  bestMembership(rows)
  assert.equal(rows[0].role, "employee")
})
