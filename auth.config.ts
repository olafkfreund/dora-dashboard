import type { NextAuthConfig } from "next-auth"

// Edge-safe config (no DB / Node-only imports) — shared by middleware and the full auth.
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [], // real providers are added in auth.ts (Node runtime)
  callbacks: {
    // Route protection for middleware.
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user
      const { pathname } = request.nextUrl
      const isPublic = pathname === "/login"
      if (isPublic) return true
      return isLoggedIn
    },
    jwt({ token, user }) {
      if (user) {
        token.uid = (user as { id?: string }).id
        token.role = (user as { role?: string }).role
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string
        session.user.role = token.role as "ADMIN" | "LEAD" | "VIEWER"
      }
      return session
    },
  },
} satisfies NextAuthConfig
