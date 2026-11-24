"use client"

import { PlatformShell } from "@/components/platform/shell"
import { OperatorsPanel } from "@/components/platform/operators"

export default function OwnerOperatorsPage() {
  return (
    <PlatformShell expect="owner" route="/portal/owner/operators" title="Operators" subtitle="Platform operators. Sub-owners hold every platform power by default; withdraw any single power here.">
      {({ session }) => <OperatorsPanel accessToken={session.accessToken} selfUserId={session.userId} />}
    </PlatformShell>
  )
}
