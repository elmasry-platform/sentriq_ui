"use client"

import { PlatformShell } from "@/components/platform/shell"
import { CapabilitiesCard, PermissionMatrix } from "@/components/portal/capabilities"
import { PortalEmpty } from "@/components/portal/states"

export default function EmployeeAccessPage() {
  return (
    <PlatformShell expect="employee" route="/portal/employee" title="My access" subtitle="Your access profile and what you can do.">
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
          <div className="platform-stack">
            <CapabilitiesCard accessToken={session.accessToken} tenantId={identity.tenantId} />
            <PermissionMatrix accessToken={session.accessToken} tenantId={identity.tenantId} />
          </div>
        )
      }}
    </PlatformShell>
  )
}
