"use client"

import { PortalShell } from "@/components/portal/shell"
import { CapabilitiesCard, PermissionMatrix } from "@/components/portal/capabilities"
import { MembersPanel } from "@/components/portal/members"
import { PortalEmpty } from "@/components/portal/states"

export default function AdminPortal() {
  return (
    <PortalShell expect="admin" title="Admin workspace" subtitle="Your live access profile and team directory.">
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
          </div>
        )
      }}
    </PortalShell>
  )
}
