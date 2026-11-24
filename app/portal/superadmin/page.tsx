"use client"

import { PortalShell } from "@/components/portal/shell"
import { CapabilitiesCard, PermissionMatrix } from "@/components/portal/capabilities"
import { MembersPanel } from "@/components/portal/members"
import { EntitlementsPanel } from "@/components/portal/entitlements"
import { PortalEmpty } from "@/components/portal/states"

export default function SuperadminPortal() {
  return (
    <PortalShell expect="superadmin" title="Company administration" subtitle="Your company's members, entitlements, and live access profile.">
      {({ session, identity }) => {
        if (!identity.tenantId) {
          return <PortalEmpty title="No active company membership" hint="Your account is not an active member of any company." />
        }
        return (
          <div className="space-y-8">
            <CapabilitiesCard accessToken={session.accessToken} tenantId={identity.tenantId} />
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Permissions</h2>
              <PermissionMatrix accessToken={session.accessToken} tenantId={identity.tenantId} />
            </section>
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Members</h2>
              <MembersPanel accessToken={session.accessToken} tenantId={identity.tenantId} selfUserId={session.userId} />
            </section>
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Entitlements</h2>
              <EntitlementsPanel accessToken={session.accessToken} tenantId={identity.tenantId} />
            </section>
          </div>
        )
      }}
    </PortalShell>
  )
}
