"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth-helpers"
import { db } from "@/db"
import { users, auditLogs } from "@/db/schema"

type ActionState = { ok?: boolean; message?: string } | undefined

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["ADMIN", "LEAD", "VIEWER"]),
})

async function audit(actorId: string, action: string, target: string, meta: Record<string, unknown>) {
  await db.insert(auditLogs).values({ actorId, action, target, meta })
}

export async function createUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin()
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const email = parsed.data.email.toLowerCase()
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing.length) return { ok: false, message: "A user with that email already exists." }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  await db.insert(users).values({
    name: parsed.data.name,
    email,
    passwordHash,
    role: parsed.data.role,
    status: "ACTIVE",
  })
  await audit(admin.id, "user.create", email, { role: parsed.data.role })
  revalidatePath("/users")
  return { ok: true, message: `Created ${email}.` }
}

export async function setRole(formData: FormData): Promise<void> {
  const admin = await requireAdmin()
  const id = String(formData.get("id") ?? "")
  const role = String(formData.get("role") ?? "") as "ADMIN" | "LEAD" | "VIEWER"
  if (!id || !["ADMIN", "LEAD", "VIEWER"].includes(role)) return
  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, id))
  await audit(admin.id, "user.setRole", id, { role })
  revalidatePath("/users")
}

export async function toggleStatus(formData: FormData): Promise<void> {
  const admin = await requireAdmin()
  const id = String(formData.get("id") ?? "")
  if (!id || id === admin.id) return // cannot disable yourself
  const rows = await db.select({ status: users.status }).from(users).where(eq(users.id, id)).limit(1)
  const current = rows[0]?.status
  if (!current) return
  const next = current === "ACTIVE" ? "DISABLED" : "ACTIVE"
  await db.update(users).set({ status: next, updatedAt: new Date() }).where(eq(users.id, id))
  await audit(admin.id, "user.setStatus", id, { status: next })
  revalidatePath("/users")
}
