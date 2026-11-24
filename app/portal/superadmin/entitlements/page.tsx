"use client"

import { PlatformShell } from "@/components/platform/shell"
import { EntitlementsPanel } from "@/components/portal/entitlements"
import { PortalEmpty } from "@/components/portal/states"

export default function SuperadminEntitlementsPage() {
  return (
    <PlatformShell expect="superadmin" route="/portal/superadmin/entitlements" titleKey="nav.entitlements" subtitleKey="ent.page.subtitle">
      {({ session, identity }) => {
        if (!identity.tenantId) {
          return <PortalEmpty titleKey="noMembership.active.title" hintKey="noMembership.active.hint" />
        }
        return <EntitlementsPanel accessToken={session.accessToken} tenantId={identity.tenantId} />
      }}
    </PlatformShell>
  )
}
