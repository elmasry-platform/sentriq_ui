import type { Metadata } from "next"

export const metadata: Metadata = {
  title: {
    default: "Workspace",
    template: "%s · SENTRIQ Workspace",
  },
}

export default function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div data-sentriq-area="workspace">{children}</div>
}
