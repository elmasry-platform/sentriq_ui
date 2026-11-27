import { conditionMatches, getQuestionRuntimeStates, type FormDefinition } from "../forms/domain.ts"

/** Answers that count: a hidden question's answer is treated as not given, and that can hide further questions. Repeats until stable. */
export function effectiveAnswers(form: FormDefinition, answers: Record<string, unknown>): Record<string, unknown> {
  let current = { ...answers }
  for (let round = 0; round <= form.questions.length; round++) {
    const states = getQuestionRuntimeStates(form, current)
    const hidden = Object.keys(current).filter((id) => states[id] && !states[id].visible)
    if (!hidden.length) return current
    current = Object.fromEntries(Object.entries(current).filter(([id]) => !hidden.includes(id)))
  }
  return current
}

export type DroppedHidden = { questionId: string; ruleIds: string[]; reason: "hide_rule" | "show_rule_not_met" }

/** Which answered questions are dropped from the submission, and which rule hid each. Recorded in the audit at submit time,
 *  so changing an early answer to hide a section stays visible to the reviewer. */
export function droppedAnswers(form: FormDefinition, answers: Record<string, unknown>): DroppedHidden[] {
  const out: DroppedHidden[] = []
  let current = { ...answers }
  for (let round = 0; round <= form.questions.length; round++) {
    const states = getQuestionRuntimeStates(form, current)
    const hidden = Object.keys(current).filter((id) => states[id] && !states[id].visible)
    if (!hidden.length) break
    for (const id of hidden) {
      const rules = form.questions.flatMap((owner) => owner.conditions).filter((rule) => rule.targetQuestionId === id)
      const matches = (rule: (typeof rules)[number]) => { const source = form.questions.find((q) => q.id === rule.sourceQuestionId); return source ? conditionMatches(rule, current[source.id], source.type) : false }
      const hideRules = rules.filter((rule) => rule.effect === "hide" && matches(rule))
      out.push(hideRules.length ? { questionId: id, ruleIds: hideRules.map((r) => r.id), reason: "hide_rule" } : { questionId: id, ruleIds: rules.filter((r) => r.effect === "show").map((r) => r.id), reason: "show_rule_not_met" })
    }
    current = Object.fromEntries(Object.entries(current).filter(([id]) => !hidden.includes(id)))
  }
  return out.filter((item) => answers[item.questionId] !== undefined && answers[item.questionId] !== "" && !(Array.isArray(answers[item.questionId]) && (answers[item.questionId] as unknown[]).length === 0))
}

/** Questions that become hidden by changing one answer, and that carry a finding. Hiding must never delete the finding: the person confirms, the finding stays. */
export function hiddenWithFindings(form: FormDefinition, before: Record<string, unknown>, after: Record<string, unknown>, findings: { questionId: string }[]): string[] {
  const was = new Set(droppedAnswers(form, before).map((d) => d.questionId)), now = droppedAnswers(form, after).map((d) => d.questionId)
  const withFinding = new Set(findings.map((f) => f.questionId))
  return now.filter((id) => !was.has(id) && withFinding.has(id))
}
