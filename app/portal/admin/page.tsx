"use client"

import { PlatformShell } from "@/components/platform/shell"
import { CapabilitiesCard, PermissionMatrix } from "@/components/portal/capabilities"
import { MembersPanel } from "@/components/portal/members"
import { PortalEmpty } from "@/components/portal/states"

export default function AdminTeamPage() {
  return (
    <PlatformShell expect="admin" route="/portal/admin" title="Team" subtitle="Your live access profile and team directory.">
      {({ session, identity }) => {
        if (!identity.tenantId) {
          return <PortalEmpty title="No active company membership" hint="Your account is not an active member of any company." />
        }
        return (
          <div className="platform-stack">
            <CapabilitiesCard accessToken={session.accessToken} tenantId={identity.tenantId} />
            <MembersPanel accessToken={session.accessToken} tenantId={identity.tenantId} selfUserId={session.userId} />
            <PermissionMatrix accessToken={session.accessToken} tenantId={identity.tenantId} />
          </div>
        )
      }}
    </PlatformShell>
  )
}
