import "server-only"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { auth } from "@/auth"
import { db } from "@/db"
import { users } from "@/db/schema"

export interface SessionUser {
  id: string
  name: string | null
  email: string | null
  role: "ADMIN" | "LEAD" | "VIEWER"
}

/**
 * Require an authenticated, still-active user — and re-read role/status from the
 * DB on every call. Under the JWT strategy the token caches role/status, so a
 * disabled or demoted user would otherwise keep access until the token expires;
 * this closes that window (session hardening).
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth()
  const id = session?.user?.id
  if (!id) redirect("/login")

  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
  const dbUser = rows[0]
  if (!dbUser || dbUser.status !== "ACTIVE") redirect("/login")

  return { id: dbUser.id, name: dbUser.name, email: dbUser.email, role: dbUser.role }
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (user.role !== "ADMIN") redirect("/")
  return user
}
