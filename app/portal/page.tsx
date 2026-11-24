"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { usePortalSession } from "@/lib/portal/session"
import { resolveIdentity } from "@/lib/portal/identity"
import { PortalLoading, PortalError } from "@/components/portal/states"
import { useState } from "react"

export default function PortalIndex() {
  const router = useRouter()
  const { session, loading } = usePortalSession()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return
    if (!session) { router.replace("/portal/login"); return }
    resolveIdentity(session.accessToken, session.userId)
      .then((identity) => {
        if (identity.role === "owner") router.replace("/portal/owner")
        else if (identity.role === "subowner") router.replace("/portal/subowner")
        else if (identity.role === "superadmin") router.replace("/portal/superadmin")
        else if (identity.membershipStatus === "none" || identity.operatorRole === "inactive") router.replace("/portal/employee")
        else router.replace(`/portal/${identity.role}`)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "identity_resolution_failed"))
  }, [session, loading, router])

  if (error) return <PortalError message={error} onRetry={() => { setError(null); router.refresh() }} />
  return <PortalLoading label="Opening your portal" />
}
