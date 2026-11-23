import test from "node:test"
import assert from "node:assert/strict"
import { buildOverview, filterWork, overdueAt, type OverviewSource } from "./overview-model.ts"
const source: OverviewSource = {
  sites: [{ id: "a", name: "A", code: "A", city: "Cairo" }], followUps: [],
  inspections: [{ id: "i1", workspaceId: "w", siteId: "a", templateId: "f", templateVersion: 1, title: "Review me", inspectorId: "u_inspector", status: "in_review", currentStage: "reviewer_1", answers: [], revision: 1, createdAt: "2026-11-01", updatedAt: "2026-11-01" }],
  actions: [{ id: "a1", workspaceId: "w", siteId: "a", findingId: "f1", inspectionId: "i1", title: "Overdue action", description: "", ownerId: "u_owner", priority: "high", status: "in_progress", responseDueAt: "2026-11-18", evidenceIds: [] }],
}
const now = new Date(2026, 10, 23, 12)
test("personal work never falls back to unrelated workspace backlog", () => { const m = buildOverview(source, "company_admin", now); assert.equal(m.items.length, 2); assert.equal(m.personal.length, 0); assert.equal(m.manager, true) })
test("platform and unknown roles get no company data", () => { for (const role of ["platform_owner", "nobody"]) { const m = buildOverview(source, role, now); assert.deepEqual(m.items, []); assert.deepEqual(m.siteStats, []) } })
test("only the current review stage is eligible and no self-review", () => { assert.equal(buildOverview(source, "reviewer_1", now).personal.length, 1); assert.equal(buildOverview(source, "reviewer_2", now).personal.length, 0); const self = structuredClone(source); self.inspections[0].inspectorId = "u_r1"; assert.equal(buildOverview(self, "reviewer_1", now).personal.length, 0) })
test("overdue work sorts before reviews and site totals agree", () => { const m = buildOverview(source, "company_admin", now); assert.equal(m.items[0].id, "a1"); assert.equal(m.siteStats[0].open, 1); assert.equal(m.siteStats[0].overdue, 1) })
test("site, search and overdue filters do not create a fallback", () => { const m = buildOverview(source, "company_admin", now); assert.equal(filterWork(m.items, "overdue", "a", "action", now).length, 1); assert.equal(filterWork(m.items, "workspace", "wrong-site", "", now).length, 0); assert.equal(filterWork(m.items, "mine", "", "missing", now).length, 0) })
test("date-only deadlines remain current through their local calendar day", () => { assert.equal(overdueAt("2026-11-23", now), false); assert.equal(overdueAt("2026-11-22", now), true); assert.equal(overdueAt("not-a-date", now), false); assert.equal(overdueAt(undefined, now), false) })
test("closure verification requires a different action owner", () => { const data = structuredClone(source); data.actions[0].status = "closure_requested"; assert.equal(buildOverview(data, "closure_reviewer", now).personal[0].id, "a1"); data.actions[0].ownerId = "u_closure"; assert.equal(buildOverview(data, "closure_reviewer", now).personal[0].review, false) })
