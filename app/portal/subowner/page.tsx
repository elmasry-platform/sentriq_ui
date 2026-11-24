"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { PlatformShell } from "@/components/platform/shell"
import { CompaniesPanel } from "@/components/portal/companies"
import { rpc } from "@/lib/portal/api"

/**
 * Sub-owner companies view: company-wide control only. People are managed on the
 * Member access page. Withdrawn powers hide their actions up front (the server
 * still enforces every withdrawal).
 */
function SubownerPanels({ accessToken }: { accessToken: string }) {
  const router = useRouter()
  const [perms, setPerms] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let active = true
    rpc<{ rows?: { permission_key: string; granted: boolean }[] }>("my_platform_permissions", {}, accessToken)
      .then((res) => {
        if (!active) return
        const map: Record<string, boolean> = {}
        for (const row of res.rows ?? []) map[row.permission_key] = row.granted
        setPerms(map)
      })
      .catch(() => {})
    return () => { active = false }
  }, [accessToken])

  return (
    <div className="platform-stack">
      <CompaniesPanel
        accessToken={accessToken}
        allowLifecycle
        canLifecycle={perms["company.lifecycle"] !== false}
        canModules={perms["entitlement.issue"] !== false}
        onInviteSuperadmin={perms["company.create"] !== false ? (c) => router.push(`/portal/subowner/invitations?company=${c.id}&level=company_superadmin`) : undefined} openLabelKey="companies.openAccess"
        onOpen={(c) => router.push(`/portal/subowner/access?company=${c.id}`)}
      />
    </div>
  )
}

export default function SubownerCompaniesPage() {
  return (
    <PlatformShell expect="subowner" route="/portal/subowner" titleKey="nav.companies" subtitleKey="subowner.companies.subtitle">
      {({ session }) => <SubownerPanels accessToken={session.accessToken} />}
    </PlatformShell>
  )
}
