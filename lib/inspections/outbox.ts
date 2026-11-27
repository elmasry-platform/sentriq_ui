import { OUTBOX_MAX_AGE_DAYS } from "./policy.ts"
import { payloadFingerprint, type SubmitMeta, type InspectionAnswer, type InspectionFinding, type InspectionRecord, type InspectionRepository } from "./repository.ts"

// A device-side queue for submissions, one queue per user AND company. An entry is written BEFORE the first send,
// so an app restart, a lost connection or a double tap retries the same client id. The server (or the local
// repository standing in for it) treats the same client id with the same payload as the same submission.
//
// Real build: this must move to IndexedDB (with a persistent-storage request) and carry photo blobs with their own
// upload status. Server contract: the payload fingerprint must be SHA-256 of the canonical answers, not this 32-bit hash.
export type OutboxState = "queued" | "syncing" | "conflict" | "blocked"
export type OutboxEntry = { clientId: string; inspectionId: string; expectedRevision: number; answers: InspectionAnswer[]; findings: InspectionFinding[]; meta?: SubmitMeta; fingerprint: string; state: OutboxState; attempts: number; queuedAt: string; lastError?: string }
export type FlushResult = { inspectionId: string; outcome: "submitted" | "conflict" | "blocked" | "offline"; record?: InspectionRecord; code?: string }
export type OutboxScope = { userId: string; workspaceId: string }
type Store = Pick<Storage, "getItem" | "setItem"> & Partial<Pick<Storage, "removeItem" | "key" | "length">>

const PREFIX = "sentriq.inspections.outbox.v2:"
const NOTICE = "sentriq.inspections.outbox.notice:"
const newClientId = () => globalThis.crypto?.randomUUID?.() ?? `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
const defaultStore = (): Store | undefined => (typeof localStorage === "undefined" ? undefined : localStorage)

/** Remove every queue on this device (sign out). Also removes the old shared queue key. */
export function wipeAllOutboxes(store: Store | undefined = defaultStore()) {
  if (!store?.key || !store.removeItem || store.length === undefined) return
  const keys: string[] = []
  for (let i = 0; i < store.length; i++) { const key = store.key(i); if (key && (key.startsWith(PREFIX) || key === "sentriq.inspections.outbox.v1")) keys.push(key) }
  for (let i = 0; i < store.length; i++) { const key = store.key(i); if (key && key.startsWith(NOTICE)) keys.push(key) }
  keys.forEach((key) => store.removeItem!(key))
}

const allKeys = (store: Store | undefined) => { const keys: string[] = []; if (store?.key && store.length !== undefined) for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k && k.startsWith(PREFIX)) keys.push(k) } return keys }
/** How many submissions wait on this device, over every queue. Used for the sign out warning. */
export function pendingCount(store: Store | undefined = defaultStore()): number {
  return allKeys(store).reduce((sum, key) => { try { const rows = JSON.parse(store!.getItem(key) ?? "[]"); return sum + (Array.isArray(rows) ? rows.length : 0) } catch { return sum } }, 0)
}
/** On sign in: remove queues that belong to anyone else (a session that ended without a sign out). */
export function wipeOtherUsers(userId: string, store: Store | undefined = defaultStore()) {
  const mine = `:${encodeURIComponent(userId)}`
  allKeys(store).filter((key) => !key.endsWith(mine)).forEach((key) => store!.removeItem?.(key))
}

export function createOutbox(scope: OutboxScope, store: Store | undefined = defaultStore()) {
  if (!scope.userId || !scope.workspaceId) throw new Error("An outbox needs a user and a company.")
  const key = `${PREFIX}${encodeURIComponent(scope.workspaceId)}:${encodeURIComponent(scope.userId)}`
  const noticeKey = `${NOTICE}${encodeURIComponent(scope.workspaceId)}:${encodeURIComponent(scope.userId)}`
  const read = (): OutboxEntry[] => {
    if (!store) return []
    try {
      const parsed = JSON.parse(store.getItem(key) ?? "[]"); if (!Array.isArray(parsed)) return []
      const oldest = Date.now() - OUTBOX_MAX_AGE_DAYS * 86_400_000
      const fresh = (parsed as OutboxEntry[]).filter((row) => !(Date.parse(row.queuedAt) < oldest))
      if (fresh.length !== parsed.length) {
        store.setItem(key, JSON.stringify(fresh))
        // Remember that answers were removed, so the person is told (never a silent loss). The draft record stays.
        store.setItem(noticeKey, String(Number(store.getItem(noticeKey) ?? 0) + (parsed.length - fresh.length)))
      }
      return fresh
    } catch { return [] }
  }
  const write = (entries: OutboxEntry[]) => { store?.setItem(key, JSON.stringify(entries)) }
  const entry = (inspectionId: string) => read().find((item) => item.inspectionId === inspectionId)

  /** Queue a submission. Same payload: the existing entry (same client id). Changed payload: the entry is replaced and gets a NEW client id, so edits are never lost. */
  const enqueue = (input: { inspectionId: string; expectedRevision: number; answers: InspectionAnswer[]; findings: InspectionFinding[]; meta?: SubmitMeta }): OutboxEntry => {
    const entries = read()
    const fingerprint = payloadFingerprint(input.answers, input.findings)
    const existing = entries.find((item) => item.inspectionId === input.inspectionId)
    if (existing && existing.fingerprint === fingerprint && (existing.state === "queued" || existing.state === "syncing")) return existing
    const next: OutboxEntry = { clientId: newClientId(), inspectionId: input.inspectionId, expectedRevision: input.expectedRevision, answers: structuredClone(input.answers), findings: structuredClone(input.findings), meta: input.meta ? structuredClone(input.meta) : undefined, fingerprint, state: "queued", attempts: 0, queuedAt: new Date().toISOString() }
    write([...entries.filter((item) => item.inspectionId !== input.inspectionId), next])
    return next
  }
  /** Drop a queued or blocked entry. The answers stay in the draft record. */
  const discard = (inspectionId: string) => write(read().filter((item) => item.inspectionId !== inspectionId))
  /** Export what is stuck, so nothing on a blocked entry is ever trapped on the device. */
  const exportBlocked = (inspectionId: string): string | undefined => { const found = entry(inspectionId); return found ? JSON.stringify({ inspectionId: found.inspectionId, answers: found.answers, findings: found.findings, queuedAt: found.queuedAt, lastError: found.lastError }, null, 2) : undefined }

  /** Send what is queued. Offline: nothing is sent and entries stay queued. A conflict keeps the answers on the device. */
  const flush = (repository: InspectionRepository, online: boolean, only?: string): FlushResult[] => {
    const results: FlushResult[] = []
    for (const item of read()) {
      if (only && item.inspectionId !== only) continue
      if (item.state === "conflict" || item.state === "blocked") continue
      if (!online) { results.push({ inspectionId: item.inspectionId, outcome: "offline" }); continue }
      write(read().map((row) => row.clientId === item.clientId ? { ...row, state: "syncing" as const, attempts: row.attempts + 1 } : row))
      try {
        const record = repository.submit(item.inspectionId, item.answers, item.expectedRevision, item.findings, item.clientId, item.meta)
        write(read().filter((row) => row.clientId !== item.clientId))
        results.push({ inspectionId: item.inspectionId, outcome: "submitted", record })
      } catch (error) {
        const code = (error as { code?: string }).code ?? "UNKNOWN"
        const conflict = code === "STALE_REVISION"
        const blocked = ["NOT_EDITABLE", "NOT_FOUND", "CLIENT_ID_PAYLOAD_MISMATCH", "REPLY_REQUIRED"].includes(code)
        write(read().map((row) => row.clientId === item.clientId ? { ...row, state: conflict ? "conflict" as const : blocked ? "blocked" as const : "queued" as const, lastError: code } : row))
        results.push({ inspectionId: item.inspectionId, outcome: conflict ? "conflict" : blocked ? "blocked" : "offline", code })
      }
    }
    return results
  }
  /** How many queued submissions the purge removed since the person last saw the message. Reading clears it. */
  const takePurged = (): number => { if (!store) return 0; read(); const n = Number(store.getItem(noticeKey) ?? 0); if (n > 0) store.setItem(noticeKey, "0"); return n }
  return { takePurged, read, entry, enqueue, discard, exportBlocked, flush }
}
export type Outbox = ReturnType<typeof createOutbox>
