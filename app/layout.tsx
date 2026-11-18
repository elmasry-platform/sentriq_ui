import type { Metadata, Viewport } from 'next'
import './globals.css'
import './sentriq.css'

export const metadata: Metadata = {
  title: {
    default: "SENTRIQ — QHSE Workspace",
    template: "%s · SENTRIQ",
  },
  description:
    "A calm, connected workspace for quality, health, safety, and environmental operations.",
}

export const viewport: Viewport = {
  themeColor: "#19262D",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
