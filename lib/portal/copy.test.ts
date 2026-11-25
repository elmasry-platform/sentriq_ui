import assert from "node:assert/strict"
import test from "node:test"
import { COPY } from "./copy.ts"

const en = COPY.en as Record<string, string>
const ar = COPY.ar as Record<string, string>
const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",")

test("every English key has an Arabic string and the reverse", () => {
  const missingAr = Object.keys(en).filter(k => !(k in ar))
  const missingEn = Object.keys(ar).filter(k => !(k in en))
  assert.deepEqual(missingAr, [])
  assert.deepEqual(missingEn, [])
})

test("no empty strings", () => {
  for (const [lang, d] of [["en", en], ["ar", ar]] as const)
    for (const [k, v] of Object.entries(d)) assert.ok(v.trim().length > 0, `${lang}:${k} is empty`)
})

test("EN and AR use the same {placeholders}", () => {
  for (const k of Object.keys(en)) if (k in ar) assert.equal(vars(ar[k]), vars(en[k]), `placeholders differ for ${k}`)
})

test("Arabic strings contain Arabic text", () => {
  const allowedLatin = new Set(["lang.toggle"])
  for (const [k, v] of Object.entries(ar)) {
    if (allowedLatin.has(k)) continue
    if (/^[\s\d{}\w.,:()/-]*$/.test(v) && /[a-z]{4,}/i.test(v)) assert.fail(`ar:${k} looks untranslated: ${v}`)
  }
})
