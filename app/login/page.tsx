import Link from "next/link"
import { ArrowLeft, ArrowUpRight, ShieldCheck } from "lucide-react"

export const metadata = { title: "Sign in", description: "Enter the SENTRIQ QHSE workspace." }

export default function LoginPage() {
  return <main className="login-page">
    <header className="login-header"><Link className="public-brand" href="/"><span className="public-mark">S</span><span>SENTRIQ<span className="brand-period">.</span></span></Link><Link className="login-back" href="/"><ArrowLeft size={15}/>Back to SENTRIQ</Link></header>
    <section className="login-content"><div className="login-aside"><p className="public-eyebrow"><span/>SECURE WORKSPACE ENTRY</p><h1>Good operations start with a clear view.</h1><p>Bring inspections, risks, and follow-through into one connected QHSE workspace.</p><div className="login-aside-foot"><ShieldCheck size={17}/><span>Designed for enterprise QHSE operations</span></div></div><div className="login-panel"><p className="public-eyebrow">WORKSPACE ACCESS</p><h2>Welcome to SENTRIQ</h2><p className="login-description">Sign in to your live workspace, or enter the workspace preview to explore the interface.</p><Link className="public-enter login-demo-button" href="/portal/login">Sign in to your workspace <ArrowUpRight size={16}/></Link><div className="demo-notice"><span className="demo-label">PREVIEW ACCESS</span><strong>Workspace preview</strong><p>This path does not verify identity or enforce user permissions. No password is requested or stored.</p></div><Link className="login-modules" href="/app/dashboard">Enter workspace preview <ArrowUpRight size={14}/></Link><Link className="login-modules" href="/app/modules">View the module directory <ArrowUpRight size={14}/></Link></div></section>
    <footer className="login-footer"><span>© 2026 SENTRIQ</span><span>FIELD INTELLIGENCE — OPERATIONAL PRECISION</span></footer>
  </main>
}
