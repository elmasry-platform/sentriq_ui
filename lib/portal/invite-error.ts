/** Company-side invitation errors that need their own copy. Company superadmins only reach this path. */
export function companyInviteErrorKey(error: unknown): "err.inv.noModule" | null {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : ""
  return raw === "company_invitation_not_allowed" ? "err.inv.noModule" : null
}
