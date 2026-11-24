"use client"

import { useEffect, useState } from "react"
import { PlatformShell } from "@/components/platform/shell"
import { CompaniesPanel, type CompanyRow } from "@/components/portal/companies"
import { CompanyDetail } from "@/components/portal/company-detail"
import { rpc } from "@/lib/portal/api"

/**
 * Sub-owner companies view. Withdrawn powers hide their actions up front
 * (the server still enforces every withdrawal); if the permission read
 * itself fails we show the actions and let the audited RPC decide.
 */
function SubownerPanels({ accessToken }: { accessToken: string }) {
  const [selected, setSelected] = useState<CompanyRow | null>(null)
  const [perms, setPerms] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let active = true
    rpc<{ rows?: { permission_key: string; granted: boolean }[] }>("my_platform_permissions", {}, accessToken)
      .then((res) => {
        if (!active) return
        const map: Record<string, boolean> = {}
        for (const row of res.rows ?? []) map[row.permission_key] = row.granted
        setPerms(map)
      })
      .catch(() => {})
    return () => { active = false }
  }, [accessToken])

  return (
    <div className="platform-stack">
      <CompaniesPanel
        accessToken={accessToken}
        allowLifecycle
        canLifecycle={perms["company.lifecycle"] !== false}
        onOpen={(c) => setSelected(c)}
      />
      {selected ? (
        <CompanyDetail
          accessToken={accessToken}
          company={selected}
          canLifecycle={perms["membership.lifecycle"] !== false}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  )
}

export default function SubownerCompaniesPage() {
  return (
    <PlatformShell expect="subowner" route="/portal/subowner" title="Companies" subtitle="Every company on the platform. Open one to see and manage its people. You hold full platform powers unless the owner withdraws one.">
      {({ session }) => <SubownerPanels accessToken={session.accessToken} />}
    </PlatformShell>
  )
}
