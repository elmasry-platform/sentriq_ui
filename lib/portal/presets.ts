import type { CopyKey } from "./i18n"

/** Starter role presets, built from the enabled permission catalog. No module names in components:
 *  this file is the one place that maps catalog keys to a tier, by the action in the key
 *  ("<module>.<area>.<action>"). Platform-governance modules are never part of a preset.
 *  Applying a preset only stages changes; nothing is saved until the reviewer gives a reason. */
export type PresetId = "viewer" | "inspector" | "manager"
export interface CatalogKey { permission_key: string; module_key: string }

/** Modules that govern the platform itself (structure, IAM). Presets never touch them. */
export const GOVERNANCE_MODULES = ["core"]
const TIER_BY_ACTION: Record<string, PresetId> = {
  read: "viewer",
  create: "inspector", upload: "inspector", update_assigned: "inspector", assigned: "inspector",
  manage: "manager", close_review: "manager", review: "manager",
}
/** Areas whose read access is a manager-level power. */
const MANAGER_AREAS = ["audit"]
const ORDER: PresetId[] = ["viewer", "inspector", "manager"]

export const isOperational = (k: CatalogKey): boolean => !GOVERNANCE_MODULES.includes(k.module_key)

function tierOf(key: string): PresetId | null {
  const parts = key.split(".")
  if (parts.length < 3) return null
  const action = parts[parts.length - 1]
  const area = parts[parts.length - 2]
  if (action === "read" && MANAGER_AREAS.includes(area)) return "manager"
  return TIER_BY_ACTION[action] ?? null
}

/** Keys a preset allows: every operational catalog key at or below its tier. */
export function presetKeys(id: PresetId, catalog: CatalogKey[]): string[] {
  const max = ORDER.indexOf(id)
  return catalog.filter(isOperational).filter((k) => { const t = tierOf(k.permission_key); return t !== null && ORDER.indexOf(t) <= max }).map((k) => k.permission_key)
}

export interface RolePreset { id: PresetId; labelKey: CopyKey; hintKey: CopyKey }
export const ROLE_PRESETS: RolePreset[] = [
  { id: "viewer", labelKey: "preset.viewer", hintKey: "preset.viewer.hint" },
  { id: "inspector", labelKey: "preset.inspector", hintKey: "preset.inspector.hint" },
  { id: "manager", labelKey: "preset.manager", hintKey: "preset.manager.hint" },
]
