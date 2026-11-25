/** Readable label for a permission key that has no hand-written copy.
 *  "operations.contractors.create_edit" -> "Create and edit contractors".
 *  `look` returns a copy string for a key, or null. Never returns snake_case. */
export function permissionLabel(key: string, look: (copyKey: string) => string | null): string {
  const exact = look(`perm.${key}`)
  if (exact) return exact
  const parts = key.split(".")
  const action = parts[parts.length - 1] ?? key
  const resource = parts.length >= 2 ? parts[parts.length - 2] : ""
  const words = (s: string) => s.replace(/_/g, " ")
  const act = look(`permact.${action}`) ?? words(action)
  const res = resource ? (look(`permres.${resource}`) ?? words(resource)) : ""
  const text = [act, res].filter(Boolean).join(" ")
  return text.charAt(0).toUpperCase() + text.slice(1)
}
