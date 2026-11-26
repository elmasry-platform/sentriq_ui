import assert from "node:assert/strict"
import test from "node:test"
import { COPY } from "./copy.ts"
import { companyInviteErrorKey } from "./invite-error.ts"

test("company_invitation_not_allowed maps to the no-module message in EN and AR", () => {
  const key = companyInviteErrorKey(new Error("company_invitation_not_allowed"))
  assert.equal(key, "err.inv.noModule")
  assert.equal((COPY.en as Record<string, string>)[key!], "Your company has no active module yet. Ask the platform owner to enable one, then try again.")
  assert.match((COPY.ar as Record<string, string>)[key!], /[\u0600-\u06FF]/)
})

test("other errors keep their generic mapping", () => {
  for (const code of ["platform_invitation_not_allowed", "invitation_already_pending", "request_failed_403", "", "boom"])
    assert.equal(companyInviteErrorKey(new Error(code)), null)
  assert.equal(companyInviteErrorKey(undefined), null)
})
