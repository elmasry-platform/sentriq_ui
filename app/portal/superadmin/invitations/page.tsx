"use client"

import { PlatformShell } from "@/components/platform/shell"
import { InvitationsPage } from "@/components/portal/invitations"
import { PortalEmpty } from "@/components/portal/states"

export default function SuperadminInvitationsPage() {
  return (
    <PlatformShell expect="superadmin" route="/portal/superadmin/invitations" titleKey="nav.invitations" subtitleKey="invites.subtitle">
      {({ session, identity }) => identity.tenantId
        ? <InvitationsPage accessToken={session.accessToken} ownTenantId={identity.tenantId} />
        : <PortalEmpty titleKey="noMembership.active.title" hintKey="noMembership.active.hint" />}
    </PlatformShell>
  )
}
