import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

export const { auth: middleware } = NextAuth(authConfig)

export const config = {
  // Protect everything except Next internals, auth API, and static assets.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|assets).*)"],
}
