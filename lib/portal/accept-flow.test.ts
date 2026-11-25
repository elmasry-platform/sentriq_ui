import assert from "node:assert/strict"
import test from "node:test"
import { registerInvited, signupMessageKey, type AcceptDeps } from "./accept-flow.ts"

const base = { email: "a@b.co", password: "correct-horse-1", password2: "correct-horse-1", token: "t".repeat(40) }
function deps(over: Partial<AcceptDeps> = {}): AcceptDeps & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    signUp: async () => { calls.push("signUp"); return { error: null, session: { accessToken: "AT" }, identities: [{}] } },
    signIn: async () => { calls.push("signIn"); return { error: null, accessToken: "AT2" } },
    acceptInvitation: async () => { calls.push("accept") },
    ...over,
  } as AcceptDeps & { calls: string[] }
}

test("short or mismatched passwords never call the server", async () => {
  const d = deps()
  assert.deepEqual(await registerInvited(d, { ...base, password: "short", password2: "short" }), { kind: "error", key: "accept.pwShort" })
  assert.deepEqual(await registerInvited(d, { ...base, password2: "different-pass-1" }), { kind: "error", key: "accept.pwMismatch" })
  assert.deepEqual(d.calls, [])
})
test("happy path: sign up with a session, then accept", async () => {
  const d = deps()
  assert.deepEqual(await registerInvited(d, base), { kind: "done" })
  assert.deepEqual(d.calls, ["signUp", "accept"])
})
test("no session: signs in, then accepts", async () => {
  const d = deps({ signUp: async () => ({ error: null, session: null, identities: [{}] }) })
  assert.deepEqual(await registerInvited(d, base), { kind: "done" })
})
test("unconfirmed mailbox asks the user to check the inbox", async () => {
  const d = deps({
    signUp: async () => ({ error: null, session: null, identities: [{}] }),
    signIn: async () => ({ error: { code: "email_not_confirmed" }, accessToken: null }),
  })
  assert.deepEqual(await registerInvited(d, base), { kind: "check_inbox" })
})
test("existing account (no identities) is reported, nothing accepted", async () => {
  const d = deps({ signUp: async () => ({ error: null, session: null, identities: [] }) })
  assert.deepEqual(await registerInvited(d, base), { kind: "error", key: "accept.exists" })
  assert.deepEqual(d.calls, [])
})
test("sign-up gate rejection reads as an invalid link", async () => {
  const d = deps({ signUp: async () => ({ error: { status: 403, message: "signup_requires_valid_invitation" }, session: null, identities: null }) })
  assert.deepEqual(await registerInvited(d, base), { kind: "error", key: "accept.invalid" })
})
test("RPC failure after sign-up is retryable and keeps the error", async () => {
  const boom = new Error("request_failed_500")
  const out = await registerInvited(deps({ acceptInvitation: async () => { throw boom } }), base)
  assert.deepEqual(out, { kind: "accept_failed", error: boom })
})
test("a thrown network error maps to the network message", async () => {
  const d = deps({ signUp: async () => { throw Object.assign(new Error("Failed to fetch"), { name: "TypeError" }) } })
  assert.deepEqual(await registerInvited(d, base), { kind: "error", key: "accept.network" })
})
test("error mapping", () => {
  assert.equal(signupMessageKey({ code: "weak_password" }), "accept.pwWeak")
  assert.equal(signupMessageKey({ status: 429 }), "accept.rate")
  assert.equal(signupMessageKey({ code: "user_already_exists" }), "accept.exists")
  assert.equal(signupMessageKey({ status: 500, message: "boom" }), "accept.generic")
})
