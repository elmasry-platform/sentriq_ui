"use client"

import { useState } from "react"
import { PlatformShell } from "@/components/platform/shell"
import { CompaniesPanel, type CompanyRow } from "@/components/portal/companies"
import { CompanyDetail } from "@/components/portal/company-detail"

export default function SubownerCompaniesPage() {
  const [selected, setSelected] = useState<CompanyRow | null>(null)
  return (
    <PlatformShell expect="subowner" route="/portal/subowner" title="Companies" subtitle="Companies in your delegated scope. You hold full platform powers unless the owner withdraws one.">
      {({ session }) => (
        <div className="platform-stack">
          <CompaniesPanel accessToken={session.accessToken} allowLifecycle onOpen={(c) => setSelected(c)} />
          {selected ? <CompanyDetail accessToken={session.accessToken} company={selected} onClose={() => setSelected(null)} /> : null}
        </div>
      )}
    </PlatformShell>
  )
}
