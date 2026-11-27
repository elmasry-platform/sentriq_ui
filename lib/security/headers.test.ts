import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const file = readFileSync(new URL("../../public/_headers", import.meta.url), "utf8")
const lines = file.split("\n").filter((l) => !l.startsWith("#") && l.trim() !== "")
const rules = lines.filter((l) => !l.startsWith(" "))
const header = (name: string) => lines.map((l) => l.trim()).find((l) => l.toLowerCase().startsWith(name.toLowerCase() + ":"))?.slice(name.length + 1).trim() ?? ""

test("one rule for every path (a second matching rule would add a second CSP)", () => {
  assert.deepEqual(rules, ["/*"])
})
test("required headers are present", () => {
  for (const h of ["Content-Security-Policy", "X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "Strict-Transport-Security", "Permissions-Policy"]) {
    assert.notEqual(header(h), "", `${h} missing`)
  }
})
test("camera and location work on our own pages only (photo and GPS questions need them)", () => {
  const policy = header("Permissions-Policy")
  assert.ok(policy.includes("camera=(self)"))
  assert.ok(policy.includes("geolocation=(self)"))
  for (const off of ["microphone=()", "payment=()", "usb=()"]) assert.ok(policy.includes(off), off)
})
test("CSP blocks framing, plugins, base tag hijack and foreign scripts", () => {
  const csp = header("Content-Security-Policy")
  for (const d of ["default-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"]) assert.ok(csp.includes(d), d)
  const script = csp.split(";").map((s) => s.trim()).find((s) => s.startsWith("script-src"))!
  assert.equal(script, "script-src 'self' 'unsafe-inline'")
  assert.equal(header("X-Frame-Options"), "DENY")
})
const connectHosts = () => {
  const connect = header("Content-Security-Policy").split(";").map((s) => s.trim()).find((s) => s.startsWith("connect-src"))!
  return connect.split(/\s+/).slice(1)
}

test("connect-src allows self plus exactly two https hosts (Supabase and backend)", () => {
  const hosts = connectHosts()
  assert.equal(hosts[0], "'self'")
  const remote = hosts.slice(1)
  assert.equal(remote.length, 2)
  for (const h of remote) assert.match(h, /^https:\/\/[a-z0-9.-]+$/, `bad host ${h}`)
})

// Drift check: when the build settings are in the environment (as on the deploy build),
// the CSP must allow exactly those two origins. Skipped when they are not set (plain CI test run).
test("connect-src matches NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_BACKEND_URL when set", (t) => {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL
  if (!supabase || !backend) return t.skip("env not set")
  const remote = connectHosts().slice(1).sort()
  assert.deepEqual(remote, [new URL(supabase).origin, new URL(backend).origin].sort())
})

test("no wildcard sources", () => {
  assert.ok(!/\s\*[\s;]/.test(header("Content-Security-Policy") + " "))
})
