import { AR_DIGITS } from "../inspections/policy.ts"
export type Language = "en" | "ar"

// One digit rule everywhere, set by AR_DIGITS in policy.ts. "ar-EG" gives Arabic-Indic digits; plain "ar" gives western digits.
export const locale = (language: Language) => (language === "ar" ? (AR_DIGITS === "arabic_indic" ? "ar-EG" : "ar") : "en")
const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩"
/** Turn Latin digits in a text into Arabic-Indic digits for the Arabic UI. Other text is untouched. */
export const localDigits = (text: string, language: Language) => (language === "ar" && AR_DIGITS === "arabic_indic" ? text.replace(/[0-9]/g, (digit) => ARABIC_INDIC[Number(digit)]) : text)

export function formatDate(value: string | undefined, language: Language, options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(locale(language), options).format(date)
}
export const formatDateTime = (value: string | undefined, language: Language) => formatDate(value, language, { dateStyle: "medium", timeStyle: "short" })
export const formatNumber = (value: number, language: Language) => new Intl.NumberFormat(locale(language)).format(value)

type Forms = { zero?: string; one: string; two?: string; few?: string; many?: string; other: string }
const plurals: Record<"en" | "ar", Record<string, Forms>> = {
  en: {
    finding: { one: "finding", other: "findings" },
    question: { one: "question", other: "questions" },
    section: { one: "section", other: "sections" },
    action: { one: "action", other: "actions" },
    inspection: { one: "inspection", other: "inspections" },
    day: { one: "day", other: "days" },
    answer: { one: "answer", other: "answers" },
  },
  ar: {
    finding: { zero: "لا ملاحظات", one: "ملاحظة واحدة", two: "ملاحظتان", few: "ملاحظات", many: "ملاحظة", other: "ملاحظة" },
    question: { zero: "لا أسئلة", one: "سؤال واحد", two: "سؤالان", few: "أسئلة", many: "سؤالًا", other: "سؤال" },
    section: { zero: "لا أقسام", one: "قسم واحد", two: "قسمان", few: "أقسام", many: "قسمًا", other: "قسم" },
    action: { zero: "لا إجراءات", one: "إجراء واحد", two: "إجراءان", few: "إجراءات", many: "إجراءً", other: "إجراء" },
    inspection: { zero: "لا تفتيشات", one: "تفتيش واحد", two: "تفتيشان", few: "تفتيشات", many: "تفتيشًا", other: "تفتيش" },
    day: { zero: "أقل من يوم", one: "يوم واحد", two: "يومان", few: "أيام", many: "يومًا", other: "يوم" },
    answer: { zero: "لا إجابات", one: "إجابة واحدة", two: "إجابتان", few: "إجابات", many: "إجابة", other: "إجابة" },
  },
}

/** "1 finding", "2 findings", and the six Arabic plural categories ("ملاحظتان", "3 ملاحظات", ...). */
export function plural(language: Language, noun: keyof typeof plurals.en, count: number) {
  const forms = plurals[language][noun]
  const category = new Intl.PluralRules(locale(language)).select(count) as keyof Forms
  const word = forms[category] ?? forms.other
  const number = formatNumber(count, language)
  if (language === "en") return `${number} ${word}`
  // Arabic zero / one / two forms already contain the quantity.
  return category === "zero" || category === "one" || category === "two" ? word : `${number} ${word}`
}

const stageNames = {
  en: { reviewer_1: "Reviewer 1", reviewer_2: "Reviewer 2", final_reviewer: "Final reviewer", completed: "Completed" },
  ar: { reviewer_1: "المراجع الأول", reviewer_2: "المراجع الثاني", final_reviewer: "المراجع النهائي", completed: "مكتمل" },
} as const
export function stageLabel(language: Language, stage: string | null | undefined) {
  if (!stage) return "—"
  return (stageNames[language] as Record<string, string>)[stage] ?? stage.replaceAll("_", " ")
}
export const completedLabel = (language: Language) => stageNames[language].completed

const errorText: Record<Language, Record<string, string>> = {
  en: {
    STALE_REVISION: "This record was changed by someone else. Reload the latest version to continue.",
    NOT_FOUND: "This record could not be found.",
    NOT_EDITABLE: "Only a draft or returned inspection can be edited.",
    NOT_WAITING_FOR_REVIEW: "This inspection is not waiting for review.",
    REASON_REQUIRED: "Enter a reason of at least 5 characters.",
    WRONG_STAGE: "This inspection is waiting for a different review stage.",
    SELF_REVIEW: "You cannot review an inspection that you carried out.",
    ALREADY_REVIEWED: "You already approved an earlier stage of this inspection.",
    INVALID_TRANSITION: "This status change is not allowed.",
    NOT_OWNER: "Only the action owner can do this.",
    NOT_VERIFIER: "Only a verifier can close or return an action.",
    SELF_VERIFY: "The action owner cannot verify their own action.",
    STORAGE_UNREADABLE: "Saved data could not be read. It has not been overwritten.",
    STORAGE_FAILED: "Your changes could not be saved in this browser.",
    UNKNOWN: "Something went wrong. Please try again.",
  },
  ar: {
    STALE_REVISION: "تم تغيير هذا السجل بواسطة شخص آخر. أعد تحميل أحدث نسخة للمتابعة.",
    NOT_FOUND: "تعذر العثور على هذا السجل.",
    NOT_EDITABLE: "يمكن تعديل التفتيش فقط وهو مسودة أو مُعاد.",
    NOT_WAITING_FOR_REVIEW: "هذا التفتيش ليس بانتظار المراجعة.",
    REASON_REQUIRED: "أدخل سببًا لا يقل عن 5 أحرف.",
    WRONG_STAGE: "هذا التفتيش بانتظار مرحلة مراجعة أخرى.",
    SELF_REVIEW: "لا يمكنك مراجعة تفتيش قمت بتنفيذه.",
    ALREADY_REVIEWED: "سبق أن اعتمدت مرحلة سابقة من هذا التفتيش.",
    INVALID_TRANSITION: "تغيير الحالة هذا غير مسموح.",
    NOT_OWNER: "مسؤول الإجراء فقط يمكنه تنفيذ ذلك.",
    NOT_VERIFIER: "المراجع المخوّل فقط يمكنه إغلاق الإجراء أو إعادته.",
    SELF_VERIFY: "لا يمكن لمسؤول الإجراء التحقق من إجرائه.",
    STORAGE_UNREADABLE: "تعذرت قراءة البيانات المحفوظة ولم يتم استبدالها.",
    STORAGE_FAILED: "تعذر حفظ تغييراتك في هذا المتصفح.",
    UNKNOWN: "حدث خطأ ما. حاول مرة أخرى.",
  },
}
export function errorMessage(language: Language, error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "UNKNOWN"
  return errorText[language][code] ?? errorText[language].UNKNOWN
}
