/** Turns the restore report counts into short lines (for a future restore result view). */
export interface RestoreReport {
  rows_not_restored?: number
  decisions_restored?: number
  action_grants_restored?: number
  profiles_restored?: number
  protected_decisions_skipped?: number
}

export function restoreLines(r: RestoreReport): { key: "restore.decisions" | "restore.grants" | "restore.profiles" | "restore.skipped" | "restore.notRestored"; count: number }[] {
  const out: { key: "restore.decisions" | "restore.grants" | "restore.profiles" | "restore.skipped" | "restore.notRestored"; count: number }[] = []
  const add = (key: (typeof out)[number]["key"], n?: number) => { if (typeof n === "number" && n > 0) out.push({ key, count: n }) }
  add("restore.decisions", r.decisions_restored)
  add("restore.grants", r.action_grants_restored)
  add("restore.profiles", r.profiles_restored)
  add("restore.skipped", r.protected_decisions_skipped)
  add("restore.notRestored", r.rows_not_restored)
  return out
}
