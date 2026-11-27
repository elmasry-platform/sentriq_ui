// Product rules that are still open or may change. Each one lives here only, so a decision changes one line.
// Frontend and backend must agree on these. Anything marked "default" is waiting for Mohamed's answer.

/** What happens to an answer when its question becomes hidden by a rule. Default. */
export const HIDDEN_ANSWER_RULE: "keep_on_device_exclude_from_submission" | "clear" = "keep_on_device_exclude_from_submission"

/** Where a returned inspection goes after the inspector resubmits. Option 3 (hybrid), relayed by Main as Mohamed's decision (original message not seen by Frontend):
 *  resume at the returning stage only if every changed answer is on a flagged question, otherwise restart at stage 1.
 *  The client result is a preview only. The server decides. */
export const RETURN_RULE = "hybrid" as const

export type ReturnAnswer = { questionId: string; value: unknown }
export type ReturnPath = { path: "resume" | "restart"; stage: string; changedQuestionIds: string[]; changedFlagged: string[]; changedUnflagged: string[] }

const isBlank = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)
const canon = (v: unknown): string => {
  if (isBlank(v)) return "~"
  if (Array.isArray(v)) return JSON.stringify(v.map((x) => canon(x)).sort()) // same choices in another order = same answer
  if (v && typeof v === "object") return JSON.stringify(Object.keys(v as object).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])]))
  return typeof v === "string" ? `s:${v.trim()}` : `${typeof v}:${String(v)}`
}
/** Question ids whose answer differs. Change and revert = no change. Order of multi-choice values does not matter. */
export function changedAnswers(before: ReturnAnswer[], after: ReturnAnswer[]): string[] {
  const a = new Map(before.map((r) => [r.questionId, canon(r.value)])), b = new Map(after.map((r) => [r.questionId, canon(r.value)]))
  return [...new Set([...a.keys(), ...b.keys()])].filter((id) => (a.get(id) ?? "~") !== (b.get(id) ?? "~")).sort()
}
/** `returned` must be the LATEST submitted version (a second return compares against the first resubmission). */
export function returnPath(input: { returnedStage: string; firstStage: string; flaggedQuestionIds: string[]; returned: ReturnAnswer[]; resubmitted: ReturnAnswer[] }): ReturnPath {
  const changedQuestionIds = changedAnswers(input.returned, input.resubmitted)
  const flagged = new Set(input.flaggedQuestionIds)
  const changedFlagged = changedQuestionIds.filter((id) => flagged.has(id)), changedUnflagged = changedQuestionIds.filter((id) => !flagged.has(id))
  const resume = changedUnflagged.length === 0 // nothing changed also resumes
  return { path: resume ? "resume" : "restart", stage: resume ? input.returnedStage : input.firstStage, changedQuestionIds, changedFlagged, changedUnflagged }
}

/** GPS questions accept typed coordinates only when the form allows it (config.manualEntry === true). Default. */
export const GPS_MANUAL_ENTRY_NEEDS_FORM_FLAG = true

/** Digits in the Arabic UI. One switch for every number and date. Open: HSE advisor says western (Egyptian UI norm), brief C2-15 says Arabic-Indic. Default western until decided. */
export const AR_DIGITS: "western" | "arabic_indic" = "western"

/** Shortest reason a reviewer must give when returning. */
export const MIN_RETURN_REASON_LENGTH = 5

/** A queued submission older than this is dropped from the device queue (answers stay in the draft). Covers a session that ended without a sign out. */
export const OUTBOX_MAX_AGE_DAYS = 14

/** Length of a written reply in characters a person sees (code points, trimmed). Not UTF-16 units: an emoji counts 1. The server must count the same way. */
export const charCount = (text: string | undefined) => [...(text ?? "").trim()].length

/** Same value as MIN_UNCHANGED_REPLY in repository.ts (kept apart so policy.ts has no imports). */
export const MIN_UNCHANGED_REPLY_LENGTH = 10
