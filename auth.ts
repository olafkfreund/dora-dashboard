import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import bcrypt from "bcryptjs"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { users, accounts, sessions, verificationTokens } from "@/db/schema"
import { authConfig } from "./auth.config"
import { loadSsoProviders } from "@/lib/sso"

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// Account lockout: after MAX_FAILED_ATTEMPTS wrong passwords, lock for LOCK_MINUTES.
const MAX_FAILED_ATTEMPTS = 5
const LOCK_MINUTES = 15

const credentialsProvider = Credentials({
  credentials: { email: {}, password: {} },
  authorize: async (raw) => {
    const parsed = credentialsSchema.safeParse(raw)
    if (!parsed.success) return null
    const email = parsed.data.email.toLowerCase()
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1)
    const user = rows[0]
    if (!user || !user.passwordHash || user.status !== "ACTIVE") return null

    // Locked out — reject regardless of password (prevents brute force).
    if (user.lockedUntil && user.lockedUntil > new Date()) return null

    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash)
    if (!ok) {
      const attempts = (user.failedLoginAttempts ?? 0) + 1
      const lock = attempts >= MAX_FAILED_ATTEMPTS
      await db
        .update(users)
        .set({
          failedLoginAttempts: lock ? 0 : attempts,
          lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : user.lockedUntil,
        })
        .where(eq(users.id, user.id))
      return null
    }

    // Success — reset counters and stamp last login.
    await db
      .update(users)
      .set({ lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null })
      .where(eq(users.id, user.id))
    return { id: user.id, name: user.name, email: user.email, role: user.role }
  },
})

// Async config: SSO providers are loaded from the DB (Settings page) at request time.
export const { handlers, auth, signIn, signOut } = NextAuth(async () => ({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [credentialsProvider, ...(await loadSsoProviders())],
}))
