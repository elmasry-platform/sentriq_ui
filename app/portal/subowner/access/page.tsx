"use client"

import { useEffect, useState } from "react"
import { PlatformShell } from "@/components/platform/shell"
import { MemberAccessPage } from "@/components/portal/member-access-page"
import { rpc } from "@/lib/portal/api"

/** Withdrawn powers hide their actions up front; the server still enforces every withdrawal.
 *  If the permission read fails we show the actions and let the audited RPC decide. */
function Panels({ accessToken }: { accessToken: string }) {
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
    <MemberAccessPage accessToken={accessToken}
      canLifecycle={perms["membership.lifecycle"] !== false}
      canPermissions={perms["member.permissions"] === true}
      canEntitlements={perms["member.entitlements"] === true} />
  )
}

export default function SubownerAccessPage() {
  return (
    <PlatformShell expect="subowner" route="/portal/subowner/access" titleKey="nav.access" subtitleKey="access.subtitle">
      {({ session }) => <Panels accessToken={session.accessToken} />}
    </PlatformShell>
  )
}
