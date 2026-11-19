export type AdminRole = "platform_owner" | "platform_subowner" | "company_superadmin" | "company_admin" | "employee"
export type Status = "Active" | "Suspended" | "Pending" | "Expired" | "Scheduled" | "Revoked" | "Accepted"
export type ModuleItem = { id: string; name: string; kind: "Module" | "Feature"; description: string; dependency: string; available: boolean }
export type Company = { id: string; name: string; industry: string; status: "Active" | "Suspended"; modules: string[]; subscription: string; members: number; created: string }
export type Member = { id: string; name: string; email: string; level: "Company Superadmin" | "Company Admin" | "Employee"; roles: string[]; status: "Active" | "Suspended"; sites: string[]; units: string[]; activity?: string }
export type Invitation = { id: string; email: string; level: "Company Admin" | "Employee"; roles: string[]; issuer: string; created: string; expires: string; status: "Pending" | "Accepted" | "Expired" | "Revoked"; site: string; unit: string }
export type Grant = { id: string; company: string; entitlement: string; scope: "Company" | "Membership"; beneficiary: string; status: "Active" | "Scheduled" | "Expired" | "Suspended" | "Revoked"; starts: string; expires: string; issuer: string; billing: "tenant_billable" | "complimentary" | "platform_absorbed"; reason: string; payer?: string }
export type FunctionalRole = { name: string; description: string; members: number; permissions: string[] }
export type AuditEvent = { at: string; actor: string; company: string; action: string; entity: string; result: "Success" | "Warning" }

export const companies: Company[] = [
  { id: "northstar", name: "Northstar Facilities", industry: "Facilities management", status: "Active", modules: ["HSE", "HSE Copilot"], subscription: "Active · renews 01 Feb 2027", members: 42, created: "12 Apr 2024" },
  { id: "cedarline", name: "Cedarline Manufacturing", industry: "Manufacturing", status: "Active", modules: ["HSE"], subscription: "Active · renews 18 Mar 2027", members: 86, created: "08 Jun 2024" },
  { id: "meridian", name: "Meridian Logistics", industry: "Transportation", status: "Suspended", modules: ["HSE"], subscription: "Suspended", members: 19, created: "22 Aug 2024" },
  { id: "atlas", name: "Atlas Energy Services", industry: "Energy", status: "Active", modules: ["HSE", "HSE Copilot"], subscription: "Expiring · 14 days", members: 57, created: "03 Jan 2025" },
  { id: "harbor", name: "Harbor Industrial", industry: "Industrial services", status: "Active", modules: [], subscription: "Trial · no commercial value", members: 12, created: "17 Feb 2025" },
]
export const modules: ModuleItem[] = [
  { id: "hse", name: "HSE", kind: "Module", description: "Health, safety and environmental workflows, inspections and corrective actions.", dependency: "Standalone", available: true },
  { id: "operations", name: "Operations", kind: "Module", description: "Operational execution and asset workflows (planned).", dependency: "Standalone", available: false },
  { id: "copilot", name: "HSE Copilot", kind: "Feature", description: "Assisted HSE workflows, licensed separately from HSE.", dependency: "Requires HSE module", available: true },
]
export const members: Member[] = [
  { id: "m1", name: "Mariam Hassan", email: "mariam.hassan@northstar.example", level: "Company Superadmin", roles: ["Auditor", "Inspector"], status: "Active", sites: ["Central facility", "North warehouse"], units: ["HSE"], activity: "Today, 09:42" },
  { id: "m2", name: "Samir Farouk", email: "samir.farouk@northstar.example", level: "Company Admin", roles: ["Reviewer 1"], status: "Active", sites: ["Central facility"], units: ["Operations"], activity: "Yesterday" },
  { id: "m3", name: "Noura Saeed", email: "noura.saeed@northstar.example", level: "Employee", roles: ["Inspector", "Action Owner"], status: "Active", sites: ["North warehouse"], units: ["HSE", "Operations"], activity: "18 Nov 2026" },
  { id: "m4", name: "Omar Khalid", email: "omar.khalid@northstar.example", level: "Employee", roles: ["Final Reviewer"], status: "Suspended", sites: ["Central facility"], units: ["Quality"], activity: "04 Nov 2026" },
  { id: "m5", name: "Lina Mansour", email: "lina.mansour@northstar.example", level: "Employee", roles: ["Reviewer 2", "Closure Reviewer"], status: "Active", sites: ["East office"], units: ["HSE"], activity: "17 Nov 2026" },
]
export const invitations: Invitation[] = [
  { id: "i1", email: "hadi.saleh@northstar.example", level: "Employee", roles: ["Inspector"], issuer: "Mariam Hassan", created: "18 Nov 2026", expires: "25 Nov 2026", status: "Pending", site: "Central facility", unit: "HSE" },
  { id: "i2", email: "dana.yusuf@northstar.example", level: "Company Admin", roles: [], issuer: "Mariam Hassan", created: "15 Nov 2026", expires: "22 Nov 2026", status: "Pending", site: "All sites", unit: "All units" },
  { id: "i3", email: "kareem.ali@northstar.example", level: "Employee", roles: ["Action Owner"], issuer: "Mariam Hassan", created: "09 Nov 2026", expires: "16 Nov 2026", status: "Expired", site: "North warehouse", unit: "Operations" },
  { id: "i4", email: "sara.nabil@northstar.example", level: "Employee", roles: ["Auditor"], issuer: "Mariam Hassan", created: "05 Nov 2026", expires: "12 Nov 2026", status: "Accepted", site: "All sites", unit: "Quality" },
]
export const grants: Grant[] = [
  { id: "g1", company: "Northstar Facilities", entitlement: "HSE Copilot", scope: "Membership", beneficiary: "Mariam Hassan · Company Superadmin", status: "Active", starts: "01 Nov 2026", expires: "01 Dec 2026", issuer: "Platform Owner", billing: "complimentary", reason: "Pilot evaluation" },
  { id: "g2", company: "Atlas Energy Services", entitlement: "HSE Copilot", scope: "Company", beneficiary: "All eligible company members", status: "Scheduled", starts: "01 Dec 2026", expires: "01 Jan 2027", issuer: "Platform Subowner", billing: "platform_absorbed", reason: "Launch support" },
  { id: "g3", company: "Cedarline Manufacturing", entitlement: "HSE", scope: "Company", beneficiary: "All eligible company members", status: "Active", starts: "01 Jan 2026", expires: "01 Jan 2027", issuer: "Platform Owner", billing: "tenant_billable", reason: "Temporary entitlement pending renewal" },
  { id: "g4", company: "Meridian Logistics", entitlement: "HSE Copilot", scope: "Company", beneficiary: "All eligible company members", status: "Expired", starts: "01 Sep 2026", expires: "01 Oct 2026", issuer: "Platform Owner", billing: "complimentary", reason: "Time-limited evaluation" },
]
export const functionalRoles: FunctionalRole[] = [
  { name: "Inspector", description: "Conduct assigned inspections and submit findings.", members: 14, permissions: ["HSE · Read", "HSE · Create", "HSE · Update"] },
  { name: "Reviewer 1", description: "Complete first-stage submission review.", members: 6, permissions: ["HSE · Read", "HSE · Review", "HSE · Return"] },
  { name: "Reviewer 2", description: "Complete second-stage quality review.", members: 3, permissions: ["HSE · Read", "HSE · Review", "HSE · Approve"] },
  { name: "Final Reviewer", description: "Approve final inspection outcomes.", members: 2, permissions: ["HSE · Read", "HSE · Approve"] },
  { name: "Action Owner", description: "Respond to and provide evidence for assigned actions.", members: 11, permissions: ["HSE · Read", "HSE · Update"] },
  { name: "Closure Reviewer", description: "Verify evidence and close corrective actions.", members: 4, permissions: ["HSE · Read", "HSE · Close"] },
  { name: "Auditor", description: "Read-only access to scoped records and reports.", members: 8, permissions: ["HSE · Read"] },
]
export const sites = ["Central facility", "North warehouse", "East office"]
export const orgUnits = ["HSE", "Operations", "Quality"]
export const auditEvents: AuditEvent[] = [
  { at: "19 Nov 2026 · 09:12", actor: "Mariam Hassan", company: "Northstar Facilities", action: "Invitation issued", entity: "Membership", result: "Success" },
  { at: "18 Nov 2026 · 16:44", actor: "Platform Owner", company: "Atlas Energy Services", action: "Copilot grant scheduled", entity: "Entitlement grant", result: "Success" },
  { at: "18 Nov 2026 · 11:08", actor: "Samir Farouk", company: "Northstar Facilities", action: "Inspection returned", entity: "Inspection", result: "Warning" },
  { at: "17 Nov 2026 · 14:30", actor: "Platform Subowner", company: "Cedarline Manufacturing", action: "Subscription renewed", entity: "Subscription", result: "Success" },
]
export const platformMetrics = [
  { label: "Companies", value: "24", note: "21 active · 3 suspended" },
  { label: "Enabled modules", value: "31", note: "Across active companies" },
  { label: "Subscriptions", value: "19", note: "3 expiring within 30 days" },
  { label: "Expiring grants", value: "2", note: "Next 30 days" },
]
