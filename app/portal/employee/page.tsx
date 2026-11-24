"use client"

import { PortalShell } from "@/components/portal/shell"
import { CapabilitiesCard, PermissionMatrix } from "@/components/portal/capabilities"
import { PortalEmpty } from "@/components/portal/states"

export default function EmployeePortal() {
  return (
    <PortalShell expect="employee" title="My workspace" subtitle="Your access profile and what you can do.">
      {({ session, identity }) => {
        if (!identity.tenantId) {
          return (
            <PortalEmpty
              title="No company membership"
              hint={identity.operatorRole === "inactive"
                ? "Your platform operator access is deactivated. Contact the platform owner."
                : "Your account is not a member of any company yet. Ask your company administrator for an invitation."}
            />
          )
        }
        return (
          <div className="space-y-8">
            <CapabilitiesCard accessToken={session.accessToken} tenantId={identity.tenantId} />
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Permissions</h2>
              <PermissionMatrix accessToken={session.accessToken} tenantId={identity.tenantId} />
            </section>
          </div>
        )
      }}
    </PortalShell>
  )
}
