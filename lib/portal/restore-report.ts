/** Turns the restore report into short lines for the "Restored access" result. */
export interface RestoreOutcome {
  rows_not_restored?: number
  not_restored_changed_or_added?: number
  not_restored_invalid_role_or_source?: number
  decisions_restored?: number
  action_grants_restored?: number
  profiles_restored?: number
  protected_decisions_skipped?: number
  decisions_or_grants_skipped?: number
  restore_failed?: number
}
export interface RestoreRow {
  snapshot_id?: string
  mode?: "restored" | "clean_slate" | "open" | "discarded" | string
  taken_at?: string
  closed_at?: string | null
  outcome?: RestoreOutcome | null
}
export type RestoreKey =
  | "restore.decisions" | "restore.grants" | "restore.profiles" | "restore.skipped" | "restore.notRestored"
  | "restore.changed" | "restore.invalid" | "restore.skippedGrants" | "restore.failed"

const ORDER: [keyof RestoreOutcome, RestoreKey][] = [
  ["decisions_restored", "restore.decisions"],
  ["action_grants_restored", "restore.grants"],
  ["profiles_restored", "restore.profiles"],
  ["protected_decisions_skipped", "restore.skipped"],
  ["decisions_or_grants_skipped", "restore.skippedGrants"],
  ["rows_not_restored", "restore.notRestored"],
  ["not_restored_changed_or_added", "restore.changed"],
  ["not_restored_invalid_role_or_source", "restore.invalid"],
  ["restore_failed", "restore.failed"],
]

export function restoreLines(r: RestoreOutcome): { key: RestoreKey; count: number }[] {
  const out: { key: RestoreKey; count: number }[] = []
  for (const [field, key] of ORDER) {
    const n = r[field]
    if (typeof n === "number" && n > 0) out.push({ key, count: n })
  }
  return out
}

/** Newest row first, as the RPC returns it. Accepts a bare array or { rows }. */
export function latestRestore(body: unknown): RestoreRow | null {
  const rows = Array.isArray(body) ? body : (body as { rows?: unknown } | null)?.rows
  return Array.isArray(rows) && rows.length > 0 ? (rows[0] as RestoreRow) : null
}
