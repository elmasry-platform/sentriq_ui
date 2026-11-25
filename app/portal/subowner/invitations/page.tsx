"use client"

import { PlatformShell } from "@/components/platform/shell"
import { InvitationsPage } from "@/components/portal/invitations"

export default function SubownerInvitationsPage() {
  return (
    <PlatformShell expect="subowner" route="/portal/subowner/invitations" titleKey="nav.invitations" subtitleKey="invites.subtitle">
      {({ session }) => <InvitationsPage accessToken={session.accessToken} />}
    </PlatformShell>
  )
}
