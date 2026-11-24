"use client"

import { PlatformShell } from "@/components/platform/shell"
import { CapabilitiesCard, PermissionMatrix } from "@/components/portal/capabilities"
import { PortalEmpty } from "@/components/portal/states"

export default function EmployeeAccessPage() {
  return (
    <PlatformShell expect="employee" route="/portal/employee" titleKey="nav.myAccess" subtitleKey="emp.page.subtitle">
      {({ session, identity }) => {
        if (!identity.tenantId) {
          return (
            <PortalEmpty
              titleKey="emp.noMembership.title"
              hintKey={identity.operatorRole === "inactive" ? "emp.noMembership.inactive.hint" : "emp.noMembership.hint"}
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
