"use client"

import { PlatformShell } from "@/components/platform/shell"
import { OwnAccessSection } from "@/components/portal/capabilities"
import { MembersPanel } from "@/components/portal/members"
import { PortalEmpty } from "@/components/portal/states"

export default function SuperadminPeoplePage() {
  return (
    <PlatformShell expect="superadmin" route="/portal/superadmin" titleKey="nav.people" subtitleKey="superadmin.page.subtitle">
      {({ session, identity }) => {
        if (!identity.tenantId) {
          return <PortalEmpty titleKey="noMembership.active.title" hintKey="noMembership.active.hint" />
        }
        return (
          <div className="platform-stack">
            <MembersPanel accessToken={session.accessToken} tenantId={identity.tenantId} selfUserId={session.userId} directory manageHref="/portal/superadmin/access" />
            <OwnAccessSection accessToken={session.accessToken} tenantId={identity.tenantId} />
          </div>
        )
      }}
    </PlatformShell>
  )
}
