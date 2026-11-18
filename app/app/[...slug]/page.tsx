import { AppShell } from "@/components/sentriq/app-shell"

export default async function WorkspacePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  const route = `/app/${slug.join("/")}`
  return <AppShell route={route} />
}
