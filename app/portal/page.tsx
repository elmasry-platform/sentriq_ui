"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { usePortalSession } from "@/lib/portal/session"
import { resolveIdentity } from "@/lib/portal/identity"
import { PortalLoading, PortalError } from "@/components/portal/states"
import { PortalLangProvider, friendlyErrorLang, t, useStoredPortalLang } from "@/lib/portal/i18n"

export default function PortalIndex() {
  const [lang] = useStoredPortalLang()
  return (
    <PortalLangProvider value={lang}>
      <PortalIndexInner lang={lang} />
    </PortalLangProvider>
  )
}

function PortalIndexInner({ lang }: { lang: "en" | "ar" }) {
  const router = useRouter()
  const { session, loading } = usePortalSession()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return
    // Full navigations, not router.replace: in the static export router.replace
    // never commits here, and it can also race supabase session persistence
    // (same reason the login page assigns window.location).
    if (!session) { window.location.assign("/portal/login"); return }
    resolveIdentity(session.accessToken, session.userId)
      .then((identity) => {
        if (identity.role === "owner") window.location.assign("/portal/owner")
        else if (identity.role === "subowner") window.location.assign("/portal/subowner")
        else if (identity.role === "superadmin") window.location.assign("/portal/superadmin")
        else if (identity.membershipStatus === "none" || identity.operatorRole === "inactive") window.location.assign("/portal/employee")
        else window.location.assign(`/portal/${identity.role}`)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "identity_resolution_failed"))
  }, [session, loading])

  if (error) return <PortalError message={friendlyErrorLang(lang, error)} onRetry={() => { setError(null); router.refresh() }} />
  return <PortalLoading label={t(lang, "portal.opening")} />
}
