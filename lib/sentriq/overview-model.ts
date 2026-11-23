import type { DashboardData } from "./dashboard-service.ts"
import { can, demoActor, hasCompanyAccess, reviewStagesFor } from "./demo-permissions.ts"

export type WorkItem = { id: string; title: string; siteId: string; ownerId: string; status: string; dueAt?: string; href: string; kind: "inspection" | "action" | "follow-up"; review: boolean }
export type OverviewSource = Pick<DashboardData, "actions" | "followUps" | "sites"> & { inspections: (Omit<DashboardData["inspections"][number], "status"> & { status: string; dueAt?: string })[] }
export type OverviewView = "mine" | "workspace" | "reviews" | "overdue"

/** Date-only deadlines expire after the local calendar day, not at UTC midnight. */
export function overdueAt(value: string | undefined, now: Date): boolean {
  if (!value) return false
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number)
    return new Date(year, month - 1, day + 1).getTime() <= now.getTime()
  }
  const time = Date.parse(value)
  return Number.isFinite(time) && time < now.getTime()
}

export function buildOverview(data: OverviewSource, role: string, now: Date) {
  const actor = demoActor(role).userId
  const stages = reviewStagesFor(role)
  const manager = can(role, "admin.access")
  if (!hasCompanyAccess(role)) return { items: [] as WorkItem[], personal: [] as WorkItem[], manager: false, siteStats: [] as { id: string; name: string; open: number; overdue: number }[] }
  const items: WorkItem[] = [
    ...data.inspections.filter((r) => !["approved", "cancelled"].includes(r.status)).map((r) => ({ id: r.id, title: r.title, siteId: r.siteId, ownerId: r.inspectorId, status: r.status, dueAt: r.dueAt, href: `/app/inspections/${r.id}`, kind: "inspection" as const, review: ["submitted", "in_review"].includes(r.status) && !!r.currentStage && stages.includes(r.currentStage) && r.inspectorId !== actor })),
    ...data.actions.filter((r) => r.status !== "closed").map((r) => ({ id: r.id, title: r.title, siteId: r.siteId, ownerId: r.ownerId, status: r.status, dueAt: r.status === "closure_requested" ? r.closureDueAt : r.responseDueAt, href: `/app/actions/${r.id}`, kind: "action" as const, review: r.status === "closure_requested" && can(role, "actions.verify") && r.ownerId !== actor })),
    ...data.followUps.filter((r) => !["completed", "cancelled"].includes(r.status)).flatMap((r) => { const parent = data.actions.find((a) => a.id === r.actionId); return parent ? [{ id: r.id, title: r.title, siteId: parent.siteId, ownerId: r.ownerId, status: r.status, dueAt: r.dueAt, href: `/app/actions/${r.actionId}`, kind: "follow-up" as const, review: false }] : [] }),
  ]
  // Never fill a personal queue with unrelated workspace records.
  const personal = items.filter((r) => r.review || (r.ownerId === actor && (r.kind !== "inspection" || ["draft", "returned", "in_progress", "scheduled"].includes(r.status))))
  const rank = (r: WorkItem) => overdueAt(r.dueAt, now) ? 0 : r.review ? 1 : r.status === "returned" ? 2 : 3
  const sort = (a: WorkItem, b: WorkItem) => rank(a) - rank(b) || (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999") || a.id.localeCompare(b.id)
  const siteStats = data.sites.map((site) => { const open = data.actions.filter((r) => r.siteId === site.id && r.status !== "closed"); return { id: site.id, name: site.name, open: open.length, overdue: open.filter((r) => overdueAt(r.status === "closure_requested" ? r.closureDueAt : r.responseDueAt, now)).length } })
  return { items: items.sort(sort), personal: personal.sort(sort), manager, siteStats }
}

export function filterWork(items: WorkItem[], view: OverviewView, siteId: string, search: string, now: Date) {
  const term = search.trim().toLocaleLowerCase()
  return items.filter((r) => (!siteId || r.siteId === siteId) && (view !== "reviews" || r.review) && (view !== "overdue" || overdueAt(r.dueAt, now)) && (!term || term.split(/\s+/).every((word) => `${r.id} ${r.title} ${r.status}`.toLocaleLowerCase().includes(word))))
}
