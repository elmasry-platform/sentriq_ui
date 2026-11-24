"use client"

import { PlatformShell } from "@/components/platform/shell"
import { EntitlementsPanel } from "@/components/portal/entitlements"
import { PortalEmpty } from "@/components/portal/states"

export default function SuperadminEntitlementsPage() {
  return (
    <PlatformShell expect="superadmin" route="/portal/superadmin/entitlements" title="Entitlements" subtitle="Module and feature entitlements for your company.">
      {({ session, identity }) => {
        if (!identity.tenantId) {
          return <PortalEmpty title="No active company membership" hint="Your account is not an active member of any company." />
        }
        return <EntitlementsPanel accessToken={session.accessToken} tenantId={identity.tenantId} />
      }}
    </PlatformShell>
  )
}
