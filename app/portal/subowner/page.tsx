"use client"

import { PortalShell } from "@/components/portal/shell"
import { CompaniesPanel } from "@/components/portal/companies"

export default function SubownerPortal() {
  return (
    <PortalShell expect="subowner" title="Sub-owner overview" subtitle="Platform companies visible to your delegated scope.">
      {({ session }) => <CompaniesPanel accessToken={session.accessToken} allowLifecycle={false} />}
    </PortalShell>
  )
}
