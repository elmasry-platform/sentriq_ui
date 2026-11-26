"use client"

import { PlatformShell } from "@/components/platform/shell"
import { MemberAccessPage } from "@/components/portal/member-access-page"
import { PortalEmpty } from "@/components/portal/states"

export default function SuperadminAccessPage() {
  return (
    <PlatformShell expect="superadmin" route="/portal/superadmin/access" titleKey="nav.access" subtitleKey="access.subtitle">
      {({ session, identity }) => identity.tenantId
        ? <MemberAccessPage accessToken={session.accessToken} ownCompany={{ tenantId: identity.tenantId, selfUserId: session.userId }} />
        : <PortalEmpty titleKey="noMembership.active.title" hintKey="noMembership.active.hint" />}
    </PlatformShell>
  )
}
