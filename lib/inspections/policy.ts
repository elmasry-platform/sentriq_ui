// Product rules that are still open or may change. Each one lives here only, so a decision changes one line.
// Frontend and backend must agree on these. Anything marked "default" is waiting for Mohamed's answer.

/** What happens to an answer when its question becomes hidden by a rule. Default. */
export const HIDDEN_ANSWER_RULE: "keep_on_device_exclude_from_submission" | "clear" = "keep_on_device_exclude_from_submission"

/** Where a returned inspection goes after the inspector resubmits. Undecided: Frontend suggests "restart", Reviewer suggests "resume". */
export const RETURN_RULE: "restart" | "resume_at_returning_stage" = "restart"

/** GPS questions accept typed coordinates only when the form allows it (config.manualEntry === true). Default. */
export const GPS_MANUAL_ENTRY_NEEDS_FORM_FLAG = true

/** Shortest reason a reviewer must give when returning. */
export const MIN_RETURN_REASON_LENGTH = 5
