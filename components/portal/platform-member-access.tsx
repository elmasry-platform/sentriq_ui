"use client"

import { useCallback, useEffect, useState } from "react"
import { rpc } from "@/lib/portal/api"
import { useFriendlyError, useT } from "@/lib/portal/i18n"
import { AccessEditor, type DecisionRow, type MemberRow } from "./members"
import { PortalError, PortalLoading } from "./states"

interface LimitRow { membership_id: string; capability_key: string; can_use: boolean; reason: string | null; updated_at: string }

/** Platform-operator view of one member's access: the same editor the company
 *  superadmin uses, saved through the audited operator RPC. For a company
 *  superadmin the editor shows their capability limits (deny = limited). */
export function PlatformMemberAccess({ accessToken, tenantId, member }: { accessToken: string; tenantId: string; member: MemberRow }) {
  const t = useT()
  const fe = useFriendlyError()
  const [decisions, setDecisions] = useState<DecisionRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const load = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    let active = true
    setError(null)
    Promise.all([
      rpc<{ rows?: DecisionRow[] }>("company_member_permission_decisions", { p_tenant_id: tenantId }, accessToken),
      rpc<{ rows?: LimitRow[] } | LimitRow[]>("platform_read_company", { p_tenant_id: tenantId, p_resource: "iam.superadmin_capability_limits", p_limit: 500 }, accessToken),
    ])
      .then(([dec, lim]) => {
        if (!active) return
        const limits = (Array.isArray(lim) ? lim : lim.rows ?? []).filter((l) => l.membership_id === member.membershipId && !l.can_use)
        const asDecisions: DecisionRow[] = limits.map((l) => ({
          id: `limit:${l.capability_key}`, membership_id: l.membership_id, permission_key: l.capability_key,
          decision: "deny", reason: l.reason, created_at: l.updated_at,
        }))
        setDecisions([...(dec.rows ?? []), ...asDecisions])
      })
      .catch((e) => { if (active) setError(fe(e)) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, tenantId, member.membershipId, tick])

  if (error) return <PortalError message={error} onRetry={load} />
  if (!decisions) return <PortalLoading label={t("people.loading")} />
  return <AccessEditor platform accessToken={accessToken} tenantId={tenantId} member={member} decisions={decisions} onSaved={load} />
}
