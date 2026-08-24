// Anonymous (no-login) access — env-gated, VIEWER-only, OFF by default.
// Lets a customer expose the read-only portal without per-user credentials
// (demos, internal kiosks, dashboards already sitting behind an SSO proxy).
// It NEVER grants ADMIN/LEAD or any write/settings/audit surface — those still
// require a real login, which stays available even while this is on.
// Edge-safe: no DB / server-only imports, so both middleware and Node runtime
// can read it.
export const ANON_ACCESS = process.env.DORA_ANON_ACCESS === "true"

// Synthetic session user handed out in anon mode. Role is pinned to VIEWER — this
// is the security invariant; do not widen it (see lib/anon.test.ts).
export const ANON_USER = {
  id: "anon",
  name: "Guest",
  email: null,
  role: "VIEWER",
} as const

if (ANON_ACCESS) {
  console.warn(
    "[SECURITY] DORA_ANON_ACCESS=true — the portal is open to anonymous VIEWER access (no login required). Real login is still required for admin/settings."
  )
}
