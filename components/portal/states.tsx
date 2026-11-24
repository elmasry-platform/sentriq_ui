"use client"

import Link from "next/link"
import { ShieldX, LoaderCircle, CircleAlert, Inbox, LogOut } from "lucide-react"

export function PortalLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-500">
      <LoaderCircle className="h-8 w-8 animate-spin" />
      <p className="text-sm font-medium">{label}...</p>
    </div>
  )
}

export function PortalDenied({ role, onSignOut }: { role: string; onSignOut: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
        <ShieldX className="h-7 w-7" />
      </div>
      <h1 className="text-xl font-semibold text-slate-900">Access denied</h1>
      <p className="max-w-md text-sm text-slate-500">
        Your account does not have the {role} role. If you believe this is wrong, contact your platform administrator.
      </p>
      <div className="flex gap-3">
        <Link href="/portal" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Go to my portal
        </Link>
        <button onClick={onSignOut} className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  )
}

export function PortalError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
        <CircleAlert className="h-7 w-7" />
      </div>
      <h1 className="text-xl font-semibold text-slate-900">Something went wrong</h1>
      <p className="max-w-md text-sm text-slate-500">{message}</p>
      <button onClick={onRetry} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
        Try again
      </button>
    </div>
  )
}

export function PortalEmpty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
        <Inbox className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="max-w-sm text-xs text-slate-500">{hint}</p>
    </div>
  )
}
