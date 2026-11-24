import type { CopyKey } from "./i18n"

/** Starter role presets. Each lists the capabilities a person with that role is
 *  given explicitly. Applying one only stages changes (nothing is saved until the
 *  reviewer gives a reason). Keys outside the catalog are ignored at apply time. */
const VIEW = [
  "hse.dashboard.read", "hse.forms.read", "hse.inspections.read", "hse.findings.read",
  "hse.actions.read", "hse.evidence.read", "hse.reports.read",
]
const INSPECT = [
  ...VIEW, "hse.inspections.create", "hse.evidence.upload", "hse.actions.update_assigned", "hse.people.assigned",
]
const MANAGE = [
  ...INSPECT, "hse.forms.manage", "hse.findings.manage", "hse.actions.manage", "hse.actions.close_review",
  "hse.inspections.review", "hse.audit.read",
]

export interface RolePreset { id: "viewer" | "inspector" | "manager"; labelKey: CopyKey; hintKey: CopyKey; keys: string[] }

export const ROLE_PRESETS: RolePreset[] = [
  { id: "viewer", labelKey: "preset.viewer", hintKey: "preset.viewer.hint", keys: VIEW },
  { id: "inspector", labelKey: "preset.inspector", hintKey: "preset.inspector.hint", keys: INSPECT },
  { id: "manager", labelKey: "preset.manager", hintKey: "preset.manager.hint", keys: MANAGE },
]
