import { getQuestionRuntimeStates, type FormDefinition } from "../forms/domain.ts"

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
