import type { Metadata } from "next"
import { AppShell } from "@/components/sentriq/app-shell"

const routeTitles: Record<string, string> = {
  dashboard: "Overview",
  "my-work": "My Work",
  modules: "Modules",
  reports: "Reports & Analytics",
  organization: "Organization & Sites",
  workspaces: "Workspaces",
  teams: "Users & Teams",
  forms: "Forms Library",
  inspections: "Inspection Management",
  incidents: "Incident Management",
  permits: "Permit to Work",
  risks: "Risk Assessments",
  compliance: "Audit & Compliance",
  actions: "Findings & Corrective Actions",
  evidence: "Documents & Evidence",
  people: "People & Workforce",
  assets: "Assets & Equipment",
  environment: "Environmental Records",
  audit: "Audit Trail",
  reviews: "Review Inbox",
  "follow-ups": "Follow-ups",
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params
  const title = routeTitles[slug[0]] ?? slug.at(-1)?.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") ?? "Workspace"
  return { title }
}

export default async function WorkspacePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  const route = `/app/${slug.join("/")}`
  return <AppShell route={route} />
}
