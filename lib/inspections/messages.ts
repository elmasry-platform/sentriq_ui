/** Warning shown before sign out while submissions still wait on this device. Arabic is a draft for native review. */
export function signOutWarning(count: number, language: "en" | "ar"): string {
  return language === "ar"
    ? `يوجد ${count} تفتيش لم يُرسل بعد على هذا الجهاز. تسجيل الخروج سيحذفها. هل تريد المتابعة؟`
    : `${count} ${count === 1 ? "inspection has" : "inspections have"} not been sent yet. Signing out deletes ${count === 1 ? "it" : "them"} from this device. Sign out anyway?`
}

/** Shown when the 14-day purge removed queued answers. The draft is kept. Arabic is a draft for native review. */
export function purgedNotice(days: number, language: "en" | "ar"): string {
  return language === "ar"
    ? `تمت إزالة الإجابات المنتظرة الأقدم من ${days} يومًا من هذا الهاتف. مسودتك محفوظة.`
    : `Queued answers older than ${days} days were removed from this phone. Your draft is kept.`
}
