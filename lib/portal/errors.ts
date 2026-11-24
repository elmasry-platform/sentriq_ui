/** Map audited API error codes to copy a person can act on. */
const ERROR_COPY: Record<string, string> = {
  platform_membership_lifecycle_not_authorized: "The owner has withdrawn this power from your sub-owner role. Ask the owner to restore it.",
  platform_companies_read_not_authorized: "The owner has withdrawn the company directory from your sub-owner role.",
  platform_operator_required: "This area is limited to platform operators.",
  platform_owner_required: "Only the platform owner can do that.",
  company_superadmin_required_for_membership_status: "Only the company superadmin can change member access.",
  invalid_membership_status_transition: "That status change isn't allowed from the member's current state.",
  membership_not_found: "That membership no longer exists. Refresh and try again.",
  tenant_not_found: "That company no longer exists. Refresh and try again.",
  invalid_tenant_status_transition: "That status change isn't allowed from the company's current state.",
  identity_resolution_failed: "We couldn't resolve your access. Try again.",
  request_failed_401: "Your session has expired. Sign in again.",
  request_failed_403: "You don't have permission to do that.",
  request_failed_404: "That record could not be found.",
  request_failed_429: "Too many attempts. Wait a moment and try again.",
}

export function friendlyError(error: unknown, fallback = "Something went wrong. Try again."): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : ""
  if (!raw) return fallback
  if (ERROR_COPY[raw]) return ERROR_COPY[raw]
  // Any *_not_authorized denial in the platform area means the owner withdrew
  // the power from this sub-owner (owners and company roles never reach these).
  if (/^[a-z0-9_]+_not_authorized$/.test(raw)) {
    return "The owner has withdrawn this power from your sub-owner role. Ask the owner to restore it."
  }
  // Unknown raw code: never show snake_case internals to a person.
  if (/^[a-z0-9_]+$/.test(raw)) return fallback
  return raw
}
