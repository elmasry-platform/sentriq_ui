import type { DemoRole } from "./dashboard-service.ts"

/**
 * Demo-only permission map. This is NOT authorization.
 * The real platform enforces permissions on the server (Laravel + PostgreSQL RLS).
 * The UI uses it only to decide which controls to show in the demo.
 *
 * Management level and functional role are different things:
 * a company admin never reviews by virtue of being an admin, and a reviewer
 * never manages the company by virtue of being a reviewer.
 */
export type Permission =
  | "inspections.read"
  | "inspections.create"
  | "inspections.execute"
  | "inspections.review.reviewer_1"
  | "inspections.review.reviewer_2"
  | "inspections.review.final_reviewer"
  | "actions.read"
  | "actions.create"
  | "actions.update_assigned"
  | "actions.verify"
  | "admin.access"

export type ReviewStage = "reviewer_1" | "reviewer_2" | "final_reviewer"
export const REVIEW_STAGES: ReviewStage[] = ["reviewer_1", "reviewer_2", "final_reviewer"]

const base: Permission[] = ["inspections.read", "actions.read"]

export const rolePermissions: Record<DemoRole, Permission[]> = {
  employee: [...base],
  inspector: [...base, "inspections.create", "inspections.execute", "actions.create", "actions.update_assigned"],
  reviewer_1: [...base, "inspections.review.reviewer_1"],
  reviewer_2: [...base, "inspections.review.reviewer_2"],
  final_reviewer: [...base, "inspections.review.final_reviewer"],
  action_owner: [...base, "actions.update_assigned"],
  closure_reviewer: [...base, "actions.verify"],
  auditor: [...base],
  form_designer: [...base],
  company_admin: [...base, "admin.access"],
  tenant_admin: [...base, "admin.access"],
  company_superadmin: [...base, "actions.create", "actions.verify", "admin.access"],
  // Platform operators are separate from company memberships and never see company records here.
  platform_owner: [],
  platform_subowner: [],
  platform_admin: [],
}

/** Deny by default: an unknown role gets nothing. */
export function can(role: string, permission: Permission): boolean {
  return (rolePermissions as Record<string, Permission[] | undefined>)[role]?.includes(permission) ?? false
}

/** The review stage(s) a role may act on, in workflow order. */
export function reviewStagesFor(role: string): ReviewStage[] {
  return REVIEW_STAGES.filter((stage) => can(role, `inspections.review.${stage}` as Permission))
}

export function canReviewAnyStage(role: string): boolean {
  return reviewStagesFor(role).length > 0
}

const actors: Record<string, { userId: string; label: string }> = {
  inspector: { userId: "u_inspector", label: "Youssef Nabil" },
  employee: { userId: "u_inspector", label: "Youssef Nabil" },
  reviewer_1: { userId: "u_r1", label: "Reviewer 1" },
  reviewer_2: { userId: "u_r2", label: "Reviewer 2" },
  final_reviewer: { userId: "u_final", label: "Final reviewer" },
  action_owner: { userId: "u_owner", label: "Action owner" },
  closure_reviewer: { userId: "u_closure", label: "Closure reviewer" },
  auditor: { userId: "u_auditor", label: "Auditor" },
  form_designer: { userId: "u_designer", label: "Form designer" },
  company_admin: { userId: "u_admin", label: "Company admin" },
  tenant_admin: { userId: "u_admin", label: "Company admin" },
  company_superadmin: { userId: "u_admin", label: "Company superadmin" },
}

/** Stable demo identity per role. Platform roles intentionally have no company identity. */
export function demoActor(role: string): { userId: string; label: string } {
  return actors[role] ?? { userId: "u_platform", label: "Platform operator" }
}

export function hasCompanyAccess(role: string): boolean {
  return can(role, "inspections.read")
}
