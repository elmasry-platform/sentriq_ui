"use client"

import { PlatformShell } from "@/components/platform/shell"
import { CapabilitiesCard, PermissionMatrix } from "@/components/portal/capabilities"
import { MembersPanel } from "@/components/portal/members"
import { PortalEmpty } from "@/components/portal/states"
import { Invitations } from "@/components/portal/invitations"

export default function SuperadminPeoplePage() {
  return (
    <PlatformShell expect="superadmin" route="/portal/superadmin" titleKey="nav.people" subtitleKey="superadmin.page.subtitle">
      {({ session, identity }) => {
        if (!identity.tenantId) {
          return <PortalEmpty titleKey="noMembership.active.title" hintKey="noMembership.active.hint" />
        }
        return (
          <div className="platform-stack">
            <CapabilitiesCard accessToken={session.accessToken} tenantId={identity.tenantId} />
            <MembersPanel accessToken={session.accessToken} tenantId={identity.tenantId} selfUserId={session.userId} />
            <Invitations accessToken={session.accessToken} tenantId={identity.tenantId} mode="member" />
            <PermissionMatrix accessToken={session.accessToken} tenantId={identity.tenantId} />
          </div>
        )
      }}
    </PlatformShell>
  )
}
