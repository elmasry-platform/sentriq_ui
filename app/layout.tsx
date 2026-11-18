import type { Metadata, Viewport } from 'next'
import './globals.css'
import './sentriq.css'
import './home.css'

export const metadata: Metadata = {
  title: {
    default: "SENTRIQ — Operational Intelligence for QHSE",
    template: "%s · SENTRIQ",
  },
  description:
    "SENTRIQ connects inspections, operational risks, compliance, incidents, and corrective actions across enterprise QHSE operations.",
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
