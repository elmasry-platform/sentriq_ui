"use client"

import { PlatformShell } from "@/components/platform/shell"
import { OperatorsPanel } from "@/components/platform/operators"

export default function OwnerOperatorsPage() {
  return (
    <PlatformShell expect="owner" route="/portal/owner/operators" titleKey="nav.operators" subtitleKey="operators.subtitle">
      {({ session }) => <OperatorsPanel accessToken={session.accessToken} selfUserId={session.userId} />}
    </PlatformShell>
  )
}
