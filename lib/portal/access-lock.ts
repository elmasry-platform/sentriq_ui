/** A company Superadmin cannot manage another Superadmin. The server refuses it; this only drives the visible lock. */
export function isReadOnlyTarget(viewerIsCompanyRole: boolean, targetRole: string): boolean {
  return viewerIsCompanyRole && targetRole === "company_superadmin"
}
