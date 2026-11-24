import { BACKEND_URL, SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase"

export type MembershipLevel = "company_superadmin" | "company_admin" | "employee"

export interface CapabilitiesProfile {
  user: { id: string; email?: string }
  tenantId: string
  membership: {
    id: string
    level: MembershipLevel
    status: string
    displayName: string | null
    siteIds: string[]
    functionalRoles: string[]
  } | null
  entitlements: { entitlement_kind: string; entitlement_key: string; entitled: boolean }[] | null
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = "ApiError" }
}

async function parse(res: Response) {
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const message = body && typeof body.message === "string" ? body.message : `request_failed_${res.status}`
    throw new ApiError(res.status, message)
  }
  return body
}

/** Capabilities profile from the trusted backend (verifies the token server-side). */
export async function getCapabilities(accessToken: string, tenantId: string): Promise<CapabilitiesProfile> {
  const res = await fetch(`${BACKEND_URL}/v1/me/capabilities?tenantId=${tenantId}`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })
  return parse(res)
}

export async function authorize(accessToken: string, tenantId: string, permissionKey: string, action: string): Promise<boolean> {
  const res = await fetch(`${BACKEND_URL}/v1/authorize`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ tenantId, permissionKey, action }),
    cache: "no-store",
  })
  const body = await parse(res)
  return body.allowed === true
}

/** Direct audited PostgREST RPC with the caller's own token (RLS enforced in the DB). */
export async function rpc<T>(fn: string, args: Record<string, unknown>, accessToken: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      "Content-Profile": "api",
      "Accept-Profile": "api",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  })
  return parse(res)
}

export async function select<T>(resource: string, query: Record<string, string>, accessToken: string): Promise<T> {
  const params = new URLSearchParams(query)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${resource}?${params}`, {
    headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${accessToken}`, "Accept-Profile": "api" },
    cache: "no-store",
  })
  return parse(res)
}
