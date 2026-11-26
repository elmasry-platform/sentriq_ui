"use client"

import { rpc, select, ApiError } from "./api"

export type PortalRole = "owner" | "subowner" | "superadmin" | "admin" | "employee"

export interface PortalIdentity {
  role: PortalRole
  operatorRole?: string
  tenantId?: string
  tenantIds: string[]
  membershipLevel?: string
  membershipStatus?: string
  displayName?: string | null
}

interface OperatorRow { user_id: string; operator_role: string; active: boolean }
interface MembershipRow { id: string; membershipId: string; workspaceId: string; role: string; status: string; displayName?: string | null }

/**
 * Resolve the signed-in user's portal identity using only audited API calls:
 * platform operators are discovered through api.platform_operator_roster,
 * company members through api.v_memberships (RLS-scoped to the caller).
 */
export async function resolveIdentity(accessToken: string, userId: string): Promise<PortalIdentity> {
  try {
    const res = await rpc<{ rows?: OperatorRow[] } | OperatorRow[]>("platform_operator_roster", { p_limit: 100 }, accessToken)
    const roster = Array.isArray(res) ? res : res.rows ?? []
    const mine = roster.find((r) => r.user_id === userId && r.active)
    if (mine) {
      return {
        role: mine.operator_role === "owner" ? "owner" : "subowner",
        operatorRole: mine.operator_role,
        tenantIds: [],
      }
    }
    // An operator row that is inactive falls through to "no access" below.
    return { role: "employee", operatorRole: "inactive", tenantIds: [] }
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 403) throw error
  }

  const memberships = await select<MembershipRow[]>("v_memberships", {
    id: `eq.${userId}`,
    select: "id,membershipId,workspaceId,role,status,displayName",
  }, accessToken)
  const active = memberships.filter((m) => m.status === "active")
  if (active.length === 0) {
    const suspended = memberships.find((m) => m.status === "suspended")
    if (suspended) return { role: "employee", tenantId: suspended.workspaceId, tenantIds: [], membershipStatus: "suspended", displayName: suspended.displayName ?? null }
    return { role: "employee", tenantIds: [], membershipStatus: "none" }
  }
  const levelRank: Record<string, PortalRole> = {
    company_superadmin: "superadmin",
    company_admin: "admin",
    employee: "employee",
  }
  const best = active.sort((a, b) => (levelRank[a.role] ? 0 : 1) - (levelRank[b.role] ? 0 : 1))[0]
  return {
    role: levelRank[best.role] ?? "employee",
    tenantId: best.workspaceId,
    tenantIds: [...new Set(active.map((m) => m.workspaceId))],
    membershipLevel: best.role,
    membershipStatus: best.status,
    displayName: best.displayName ?? null,
  }
}
