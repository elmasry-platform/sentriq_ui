"use client"

import { useState } from "react"
import { PlatformShell } from "@/components/platform/shell"
import { CompaniesPanel, type CompanyRow } from "@/components/portal/companies"
import { CompanyDetail } from "@/components/portal/company-detail"

export default function OwnerCompaniesPage() {
  const [selected, setSelected] = useState<CompanyRow | null>(null)
  return (
    <PlatformShell expect="owner" route="/portal/owner" title="Companies" subtitle="Every company on the platform. Open one to manage its people; suspend or reactivate with a reason.">
      {({ session }) => (
        <div className="platform-stack">
          <CompaniesPanel accessToken={session.accessToken} allowLifecycle onOpen={(c) => setSelected(c)} />
          {selected ? <CompanyDetail accessToken={session.accessToken} company={selected} onClose={() => setSelected(null)} /> : null}
        </div>
      )}
    </PlatformShell>
  )
}
