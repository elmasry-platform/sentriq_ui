"use client"

import { useRouter } from "next/navigation"
import { PlatformShell } from "@/components/platform/shell"
import { CompaniesPanel } from "@/components/portal/companies"

export default function OwnerCompaniesPage() {
  const router = useRouter()
  return (
    <PlatformShell expect="owner" route="/portal/owner" titleKey="nav.companies" subtitleKey="owner.companies.subtitle">
      {({ session }) => (
        <div className="platform-stack">
          <CompaniesPanel accessToken={session.accessToken} allowLifecycle canModules onInviteSuperadmin={(c) => router.push(`/portal/owner/invitations?company=${c.id}&level=company_superadmin`)} openLabelKey="companies.openAccess" onOpen={(c) => router.push(`/portal/owner/access?company=${c.id}`)} />
        </div>
      )}
    </PlatformShell>
  )
}
