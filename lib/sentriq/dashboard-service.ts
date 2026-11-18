import seed from "@/data/mock-data.json"

export type DemoRole =
  | "platform_admin"
  | "tenant_admin"
  | "form_designer"
  | "inspector"
  | "reviewer_1"
  | "reviewer_2"
  | "final_reviewer"
  | "action_owner"
  | "closure_reviewer"
  | "auditor"

export type InspectionStatus = "draft" | "submitted" | "in_review" | "returned" | "approved"
export type ActionStatus = "open" | "in_progress" | "closure_requested" | "closed"
export type Priority = "low" | "medium" | "high" | "critical"

type Workspace = { id: string; name: string; industryLabel: string; sites: { id: string; name: string; code: string; city: string }[] }
type User = { id: string; displayName: string; email: string; role: DemoRole; workspaceId: string; siteIds: string[] }
type Inspection = { id: string; workspaceId: string; siteId: string; templateId: string; templateVersion: number; title: string; inspectorId: string; status: InspectionStatus; currentStage: "reviewer_1" | "reviewer_2" | "final_reviewer" | null; answers: unknown[]; revision: number; createdAt: string; submittedAt?: string; updatedAt: string }
type Action = { id: string; workspaceId: string; siteId: string; findingId: string; inspectionId: string; title: string; description: string; ownerId: string; priority: Priority; status: ActionStatus; responseDueAt?: string; closureDueAt?: string; evidenceIds: string[] }
type FollowUp = { id: string; actionId: string; title: string; ownerId: string; dueAt: string; status: "open" | "in_progress" | "completed" | "cancelled"; outcome?: string | null }
type Finding = { id: string; workspaceId: string; inspectionId: string; title: string; description: string; priority: Priority; status: "open" | "action_created" | "resolved" }
type AuditEvent = { id: string; workspaceId?: string; actorId: string; action: string; recordType: string; recordId: string; summary: string; at: string }
type SeedData = { workspaces: Workspace[]; users: User[]; inspections: Inspection[]; actions: Action[]; followUps: FollowUp[]; findings: Finding[]; auditEvents: AuditEvent[] }

const data = seed as SeedData
export const demoRoles: { value: DemoRole; en: string; ar: string }[] = [
  { value: "platform_admin", en: "Platform Admin", ar: "مدير المنصة" },
  { value: "tenant_admin", en: "Tenant Admin", ar: "مدير المؤسسة" },
  { value: "form_designer", en: "Form Designer", ar: "مصمم النماذج" },
  { value: "inspector", en: "Inspector", ar: "مفتش" },
  { value: "reviewer_1", en: "Reviewer 1", ar: "المراجع الأول" },
  { value: "reviewer_2", en: "Reviewer 2", ar: "المراجع الثاني" },
  { value: "final_reviewer", en: "Final Reviewer", ar: "المراجع النهائي" },
  { value: "action_owner", en: "Action Owner", ar: "مسؤول الإجراء" },
  { value: "closure_reviewer", en: "Closure Reviewer", ar: "مراجع الإغلاق" },
  { value: "auditor", en: "Auditor / Viewer", ar: "مدقق / مشاهد" },
]

export type DashboardData = {
  inspections: Inspection[]
  actions: Action[]
  followUps: FollowUp[]
  findings: Finding[]
  auditEvents: AuditEvent[]
  sites: Workspace["sites"]
  users: User[]
  workspace: Workspace
}

export interface SentriqDashboardService {
  getDashboard(workspaceId: string): DashboardData
}

export const mockSentriqDashboardService: SentriqDashboardService = {
  getDashboard(workspaceId) {
    const workspace = data.workspaces.find((item) => item.id === workspaceId) ?? data.workspaces[0]
    const inspections = data.inspections.filter((item) => item.workspaceId === workspace.id)
    const actions = data.actions.filter((item) => item.workspaceId === workspace.id)
    const actionIds = new Set(actions.map((item) => item.id))
    return {
      workspace,
      inspections,
      actions,
      followUps: data.followUps.filter((item) => actionIds.has(item.actionId)),
      findings: data.findings.filter((item) => item.workspaceId === workspace.id),
      auditEvents: data.auditEvents.filter((item) => !item.workspaceId || item.workspaceId === workspace.id),
      sites: workspace.sites,
      users: data.users.filter((item) => item.workspaceId === workspace.id),
    }
  },
}
