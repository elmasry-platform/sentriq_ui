export type MemberLevelRole = "superadmin" | "admin" | "employee"

export const LEVEL_ROLE: Record<string, MemberLevelRole> = {
  company_superadmin: "superadmin",
  company_admin: "admin",
  employee: "employee",
}

const RANK: Record<MemberLevelRole, number> = { superadmin: 3, admin: 2, employee: 1 }

export function levelRank(role: string): number {
  const r = LEVEL_ROLE[role]
  return r ? RANK[r] : 0
}

/** Highest level wins. Ties keep the original order (stable). Returns a new array. */
export function bestMembership<T extends { role: string }>(rows: readonly T[]): T | undefined {
  return [...rows].sort((a, b) => levelRank(b.role) - levelRank(a.role))[0]
}
