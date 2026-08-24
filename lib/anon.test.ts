import { describe, it, expect } from "vitest"
import { ANON_USER } from "./anon"

// Security invariant: the anonymous fallback user must never carry elevated
// privileges. If someone widens this, the whole no-login mode becomes an
// unauthenticated admin backdoor — fail loudly here.
describe("ANON_USER", () => {
  it("is pinned to VIEWER and never admin/lead", () => {
    expect(ANON_USER.role).toBe("VIEWER")
  })
  it("has a stable synthetic id", () => {
    expect(ANON_USER.id).toBe("anon")
  })
})
