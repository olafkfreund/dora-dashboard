import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

// Edge-safe auth middleware (uses the DB-free config; JWT verification only).
export default NextAuth(authConfig).auth

export const config = {
  // Protect everything except Next internals, auth API, the secret-guarded digest
  // trigger (auths via DIGEST_SECRET header, for the CronJob), and static assets.
  matcher: ["/((?!api/auth|api/digest|api/metrics|_next/static|_next/image|favicon.ico|assets).*)"],
}
