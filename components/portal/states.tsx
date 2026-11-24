"use client"

import type { ReactNode } from "react"
import { EmptyState, ErrorState, LoadingState, PermissionDenied } from "@/components/sentriq/states"

/** Portal states share the product's state components so every screen looks identical. */
export function PortalLoading({ label = "Loading" }: { label?: string }) {
  return <div className="platform-boot-inline"><LoadingState label={label} /></div>
}

export function PortalDenied({ role, onSignOut }: { role: string; onSignOut: () => void }) {
  return (
    <div className="platform-boot-inline">
      <PermissionDenied title="Access denied" reason={`Your account does not have the ${role} role. If you believe this is wrong, contact your platform administrator.`} backHref="/portal" backLabel="Go to my portal" />
      <div className="platform-boot-signout"><button type="button" className="button-outline" onClick={onSignOut}>Sign out</button></div>
    </div>
  )
}

export function PortalError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="platform-boot-inline"><ErrorState title={message} onRetry={onRetry} retryLabel="Try again" /></div>
}

export function PortalEmpty({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return <EmptyState title={title} hint={hint} action={action} />
}
