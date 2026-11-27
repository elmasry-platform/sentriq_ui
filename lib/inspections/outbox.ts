import type { InspectionAnswer, InspectionFinding, InspectionRecord, InspectionRepository } from "./repository.ts"

// A device-side queue for submissions. An entry is written BEFORE the first send, so an app restart,
// a lost connection or a double tap always retries the same client id. The server (or the local
// repository standing in for it) treats the same client id as the same submission.
export type OutboxState = "queued" | "syncing" | "conflict" | "blocked"
export type OutboxEntry = { clientId: string; inspectionId: string; expectedRevision: number; answers: InspectionAnswer[]; findings: InspectionFinding[]; state: OutboxState; attempts: number; queuedAt: string; lastError?: string }
export type FlushResult = { inspectionId: string; outcome: "submitted" | "conflict" | "blocked" | "offline"; record?: InspectionRecord; code?: string }

const KEY = "sentriq.inspections.outbox.v1"
type Store = Pick<Storage, "getItem" | "setItem">
const storeOf = (store?: Store): Store | undefined => store ?? (typeof localStorage === "undefined" ? undefined : localStorage)
const newClientId = () => globalThis.crypto?.randomUUID?.() ?? `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`

export function readOutbox(store?: Store): OutboxEntry[] {
  const s = storeOf(store); if (!s) return []
  try { const parsed = JSON.parse(s.getItem(KEY) ?? "[]"); return Array.isArray(parsed) ? parsed : [] } catch { return [] }
}
function writeOutbox(entries: OutboxEntry[], store?: Store) { storeOf(store)?.setItem(KEY, JSON.stringify(entries)) }

export function outboxEntry(inspectionId: string, store?: Store) { return readOutbox(store).find((entry) => entry.inspectionId === inspectionId) }

/** Queue a submission. A second call for the same inspection reuses the existing entry (same client id) and never adds another. */
export function enqueueSubmission(input: { inspectionId: string; expectedRevision: number; answers: InspectionAnswer[]; findings: InspectionFinding[] }, store?: Store): OutboxEntry {
  const entries = readOutbox(store)
  const existing = entries.find((entry) => entry.inspectionId === input.inspectionId)
  if (existing) return existing
  const entry: OutboxEntry = { clientId: newClientId(), inspectionId: input.inspectionId, expectedRevision: input.expectedRevision, answers: structuredClone(input.answers), findings: structuredClone(input.findings), state: "queued", attempts: 0, queuedAt: new Date().toISOString() }
  writeOutbox([...entries, entry], store)
  return entry
}

export function discardQueued(inspectionId: string, store?: Store) { writeOutbox(readOutbox(store).filter((entry) => entry.inspectionId !== inspectionId), store) }

/** Update the stored answers of a queued entry after the user resolved a conflict. Keeps the client id. */
export function reviseQueued(inspectionId: string, patch: { expectedRevision: number; answers: InspectionAnswer[]; findings: InspectionFinding[] }, store?: Store) {
  writeOutbox(readOutbox(store).map((entry) => entry.inspectionId === inspectionId ? { ...entry, ...structuredClone(patch), state: "queued" as const, lastError: undefined } : entry), store)
}

/** Send what is queued. Offline: nothing is sent and entries stay queued. A conflict keeps the answers on the device. */
export function flushOutbox(repository: InspectionRepository, online: boolean, store?: Store, only?: string): FlushResult[] {
  const results: FlushResult[] = []
  const entries = readOutbox(store)
  for (const entry of entries) {
    if (only && entry.inspectionId !== only) continue
    if (entry.state === "conflict" || entry.state === "blocked") continue
    if (!online) { results.push({ inspectionId: entry.inspectionId, outcome: "offline" }); continue }
    entry.state = "syncing"; entry.attempts += 1; writeOutbox(entries, store)
    try {
      const record = repository.submit(entry.inspectionId, entry.answers, entry.expectedRevision, entry.findings, entry.clientId)
      writeOutbox(readOutbox(store).filter((item) => item.clientId !== entry.clientId), store)
      results.push({ inspectionId: entry.inspectionId, outcome: "submitted", record })
    } catch (error) {
      const code = (error as { code?: string }).code ?? "UNKNOWN"
      const conflict = code === "STALE_REVISION"
      const blocked = ["NOT_EDITABLE", "NOT_FOUND", "CLIENT_ID_PAYLOAD_MISMATCH"].includes(code)
      entry.state = conflict ? "conflict" : blocked ? "blocked" : "queued"; entry.lastError = code
      writeOutbox(readOutbox(store).map((item) => item.clientId === entry.clientId ? entry : item), store)
      results.push({ inspectionId: entry.inspectionId, outcome: conflict ? "conflict" : blocked ? "blocked" : "offline", code })
    }
  }
  return results
}
