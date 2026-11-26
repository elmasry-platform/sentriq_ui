import Link from "next/link"
import { ArrowRight, CheckCircle2, ClipboardCheck, Clock3, ListChecks } from "lucide-react"
import type { DashboardData } from "@/lib/sentriq/dashboard-service"
import type { DemoRole } from "@/lib/sentriq/dashboard-service"
import type { Language } from "@/components/sentriq/app-shell"

type Props = { data: DashboardData; role: DemoRole; language: Language }

export function MyWork({ data, role, language }: Props) {
  const rtl = language === "ar"
  const user = data.users.find((candidate) => candidate.role === role) ?? data.users[0]
  const assignedActions = data.actions.filter((action) => action.ownerId === user?.id && action.status !== "closed")
  const assignedFollowUps = data.followUps.filter((followUp) => followUp.ownerId === user?.id && !["completed", "cancelled"].includes(followUp.status))
  const pendingReviews = data.inspections.filter((inspection) => {
    if (!["submitted", "in_review"].includes(inspection.status)) return false
    if (role === "reviewer_1") return inspection.currentStage === "reviewer_1"
    if (role === "reviewer_2") return inspection.currentStage === "reviewer_2"
    if (role === "final_reviewer") return inspection.currentStage === "final_reviewer"
    return true
  })
  const queues = [
    { title: rtl ? "الإجراءات المسندة إليّ" : "Actions assigned to me", count: assignedActions.length, href: "/app/actions", icon: ListChecks, items: assignedActions.map((action) => ({ id: action.id, title: action.title, detail: action.status.replaceAll("_", " "), href: `/app/actions/${action.id}` })) },
    { title: rtl ? "المراجعات المعلقة" : "Pending reviews", count: pendingReviews.length, href: "/app/reviews", icon: ClipboardCheck, items: pendingReviews.map((inspection) => ({ id: inspection.id, title: inspection.title, detail: inspection.id, href: `/app/inspections/${inspection.id}` })) },
    { title: rtl ? "المتابعات" : "Follow-ups", count: assignedFollowUps.length, href: "/app/follow-ups", icon: Clock3, items: assignedFollowUps.map((followUp) => ({ id: followUp.id, title: followUp.title, detail: followUp.status.replaceAll("_", " "), href: "/app/follow-ups" })) },
  ]

  return <section className="my-work-page">
    <div className="module-page-heading"><p className="eyebrow">SENTRIQ / WORKSPACE</p><h1>{rtl ? "مساحة عملي" : "My Work"}</h1><p>{rtl ? "نظرة واحدة على الإجراءات والمراجعات والمتابعات المرتبطة بدورك الحالي." : "A focused view of assigned actions, reviews, and follow-ups for your current preview role."}</p></div>
    <div className="my-work-user"><span className="my-work-user-icon"><CheckCircle2 size={17} /></span><span><strong>{user?.displayName ?? (rtl ? "مستخدم مساحة العمل" : "Workspace user")}</strong><small>{rtl ? "دور معاينة · بيانات توضيحية" : "Preview role · illustrative workspace data"}</small></span></div>
    <div className="my-work-queues">{queues.map(({ title, count, href, icon: Icon, items }) => <article className="my-work-queue" key={title}><header><span className="my-work-queue-icon"><Icon size={17} /></span><span className="my-work-queue-count">{count}</span></header><h2>{title}</h2><Link className="my-work-queue-view" href={href}>{rtl ? "فتح قائمة العمل" : "Open queue"}<ArrowRight size={14} /></Link><div className="my-work-items">{items.length ? items.slice(0, 3).map((item) => <Link href={item.href} key={item.id}><strong>{item.title}</strong><small>{item.detail}</small></Link>) : <p>{rtl ? "لا توجد عناصر تتطلب إجراءً الآن." : "No items need your attention right now."}</p>}</div></article>)}</div>
  </section>
}
