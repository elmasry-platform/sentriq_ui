"use client"

import { PlatformShell } from "@/components/platform/shell"
import { MemberAccessPage } from "@/components/portal/member-access-page"

export default function OwnerAccessPage() {
  return (
    <PlatformShell expect="owner" route="/portal/owner/access" titleKey="nav.access" subtitleKey="access.subtitle">
      {({ session }) => <MemberAccessPage accessToken={session.accessToken} />}
    </PlatformShell>
  )
}
