"use client"

import type { ReactNode } from "react"
import { EmptyState, ErrorState, LoadingState, PermissionDenied } from "@/components/sentriq/states"
import { useT, type CopyKey } from "@/lib/portal/i18n"

/** Portal states share the product's state components so every screen looks identical. */
export function PortalLoading({ label }: { label: string }) {
  return <div className="platform-boot-inline"><LoadingState label={label} /></div>
}

export function PortalError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useT()
  return <div className="platform-boot-inline"><ErrorState title={message} onRetry={onRetry} retryLabel={t("generic.retry")} /></div>
}

export function PortalEmpty({ title, hint, titleKey, hintKey, action }: {
  title?: string; hint?: string; titleKey?: CopyKey; hintKey?: CopyKey; action?: ReactNode
}) {
  const t = useT()
  return <EmptyState title={titleKey ? t(titleKey) : title ?? ""} hint={hintKey ? t(hintKey) : hint} action={action} />
}
