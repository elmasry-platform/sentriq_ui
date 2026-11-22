import test from "node:test"
import assert from "node:assert/strict"
import { can, canReviewAnyStage, demoActor, reviewStagesFor, rolePermissions } from "./demo-permissions.ts"
import { demoRoles } from "./dashboard-service.ts"

test("every role in the demo role picker has an entry", () => {
  for (const role of demoRoles) assert.ok(role.value in rolePermissions, `missing ${role.value}`)
})
test("company admin and superadmin cannot review by management level alone", () => {
  assert.equal(can("company_admin", "inspections.review.reviewer_1"), false)
  assert.equal(can("company_superadmin", "inspections.review.final_reviewer"), false)
  assert.equal(canReviewAnyStage("company_admin"), false)
})
test("employee cannot create or execute inspections", () => {
  assert.equal(can("employee", "inspections.create"), false)
  assert.equal(can("employee", "inspections.execute"), false)
  assert.equal(can("employee", "inspections.read"), true)
})
test("a reviewer can act only on the matching stage", () => {
  assert.deepEqual(reviewStagesFor("reviewer_1"), ["reviewer_1"])
  assert.equal(can("reviewer_1", "inspections.review.reviewer_2"), false)
  assert.deepEqual(reviewStagesFor("final_reviewer"), ["final_reviewer"])
})
test("verification of actions is limited to closure reviewer and company superadmin", () => {
  assert.equal(can("closure_reviewer", "actions.verify"), true)
  assert.equal(can("company_superadmin", "actions.verify"), true)
  assert.equal(can("inspector", "actions.verify"), false)
  assert.equal(can("reviewer_1", "actions.verify"), false)
})
test("platform operators have no access to company records", () => {
  for (const role of ["platform_owner", "platform_subowner", "platform_admin"]) assert.equal(can(role, "inspections.read"), false)
})
test("unknown roles are denied by default", () => {
  assert.equal(can("made_up_role", "inspections.read"), false)
  assert.equal(canReviewAnyStage("made_up_role"), false)
})
test("demo actors keep the ids that existing data uses", () => {
  assert.equal(demoActor("inspector").userId, "u_inspector")
  assert.equal(demoActor("reviewer_1").userId, "u_r1")
  assert.equal(demoActor("reviewer_2").userId, "u_r2")
  assert.equal(demoActor("final_reviewer").userId, "u_final")
})
