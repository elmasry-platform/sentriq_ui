"use client"

import { PlatformShell } from "@/components/platform/shell"
import { InvitationsPage } from "@/components/portal/invitations"

export default function OwnerInvitationsPage() {
  return (
    <PlatformShell expect="owner" route="/portal/owner/invitations" titleKey="nav.invitations" subtitleKey="invites.subtitle">
      {({ session }) => <InvitationsPage accessToken={session.accessToken} />}
    </PlatformShell>
  )
}
