import type { ReactNode } from "react"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock3, Inbox, Lock, ShieldCheck } from "lucide-react"
import type { Language } from "@/lib/sentriq/format"

/** Shared loading / empty / error / permission-denied states used by every record screen. */
export function LoadingState({ label }: { label: string }) {
  return <div className="ux-loading" role="status" aria-busy="true" aria-label={label}><span /><span /><span /></div>
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return <div className="ux-state"><span className="ux-state-icon"><Inbox size={22} /></span><h2>{title}</h2>{hint && <p>{hint}</p>}{action}</div>
}

export function ErrorState({ title, onRetry, retryLabel }: { title: string; onRetry?: () => void; retryLabel?: string }) {
  return <div className="ux-state ux-state-error" role="alert"><span className="ux-state-icon"><AlertTriangle size={22} /></span><h2>{title}</h2>{onRetry && <button type="button" className="button-outline" onClick={onRetry}>{retryLabel}</button>}</div>
}

export function PermissionDenied({ title, reason, backHref, backLabel }: { title: string; reason: string; backHref?: string; backLabel?: string }) {
  return <div className="ux-state ux-state-locked" role="status"><span className="ux-state-icon"><Lock size={22} /></span><h2>{title}</h2><p>{reason}</p>{backHref && <Link className="button-outline" href={backHref}>{backLabel}</Link>}</div>
}

const statusIcons = { approved: CheckCircle2, closed: CheckCircle2, returned: AlertTriangle, overdue: AlertTriangle, in_review: Clock3, submitted: Clock3, closure_requested: ShieldCheck } as const
export type BadgeStatus = string

/** Status chips always carry an icon and a text label: color is never the only signal. */
export function StatusBadge({ status, label }: { status: BadgeStatus; label: string }) {
  const Icon = (statusIcons as Record<string, typeof ClipboardCheck>)[status] ?? ClipboardCheck
  return <span className={`ux-badge ux-badge-${status.replaceAll("_", "-")}`}><Icon size={14} aria-hidden="true" />{label}</span>
}

export function PriorityBadge({ priority, label }: { priority: string; label: string }) {
  return <span className={`ux-priority ux-priority-${priority}`}><i aria-hidden="true" />{label}</span>
}

export function Stepper({ steps, current, done }: { steps: { id: string; label: string }[]; current?: string | null; done: string[] }) {
  return <ol className="ux-stepper">{steps.map((step, index) => {
    const state = done.includes(step.id) ? "done" : step.id === current ? "current" : "todo"
    return <li key={step.id} className={`ux-step ux-step-${state}`} aria-current={state === "current" ? "step" : undefined}><span className="ux-step-dot">{state === "done" ? <CheckCircle2 size={16} aria-hidden="true" /> : index + 1}</span><span className="ux-step-label">{step.label}</span></li>
  })}</ol>
}
