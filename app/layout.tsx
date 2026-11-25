import type { Metadata, Viewport } from 'next'
import './globals.css'
import './sentriq.css'
import './sentriq-polish.css'
import './home.css'
import './sentriq-workspace.css'

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

/** On portal pages, apply the stored language to <html> before first paint and hold the page until React has applied it. */
const PORTAL_LANG_SCRIPT = `try{if(location.pathname.indexOf("/portal")===0){var l=localStorage.getItem("sentriq-portal-lang");var e=document.documentElement;if(l==="ar"){e.lang="ar";e.dir="rtl";e.setAttribute("data-portal-pending","");setTimeout(function(){e.removeAttribute("data-portal-pending")},2500)}}}catch(_){}`

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PORTAL_LANG_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
