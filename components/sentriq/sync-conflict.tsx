"use client"

import { useState } from "react"
import type { InspectionAnswer } from "@/lib/inspections/repository"
import { words } from "@/lib/sentriq/inspections-i18n"
import type { Language } from "@/lib/sentriq/format"

export type ConflictItem = { questionId: string; label: string; mine: string; server: string }
type Props = { items: ConflictItem[]; language: Language; onResolve: (choices: Record<string, "mine" | "server">) => void }

// Shows only the answers that differ. Nothing is merged for the user: every difference needs a choice.
export function SyncConflict({ items, language, onResolve }: Props) {
  const t = words[language]
  const [choices, setChoices] = useState<Record<string, "mine" | "server">>({})
  const complete = items.every((item) => choices[item.questionId])
  return <section className="sync-conflict" role="group" aria-label={t.resolveTitle}>
    <strong>{t.resolveTitle}</strong>
    {items.map((item) => <div className="sync-conflict-row" key={item.questionId}>
      <span className="sync-conflict-q">{item.label}</span>
      {(["mine", "server"] as const).map((side) => <button type="button" key={side} aria-pressed={choices[item.questionId] === side} className={`sync-conflict-choice${choices[item.questionId] === side ? " is-chosen" : ""}`} onClick={() => setChoices((current) => ({ ...current, [item.questionId]: side }))}><small>{side === "mine" ? t.mine : t.server}</small><span>{side === "mine" ? item.mine : item.server}</span></button>)}
    </div>)}
    <button type="button" className="button-primary" disabled={!complete} onClick={() => onResolve(choices)}>{t.resolveDone}</button>
  </section>
}

export function differingAnswers(mine: InspectionAnswer[], server: InspectionAnswer[]): string[] {
  const left = new Map(mine.map((row) => [row.questionId, JSON.stringify(row.value ?? null)]))
  const right = new Map(server.map((row) => [row.questionId, JSON.stringify(row.value ?? null)]))
  return [...new Set([...left.keys(), ...right.keys()])].filter((id) => (left.get(id) ?? "null") !== (right.get(id) ?? "null"))
}
