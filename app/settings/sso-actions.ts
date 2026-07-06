"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth-helpers"
import { db } from "@/db"
import { ssoProviders, auditLogs } from "@/db/schema"
import { encryptSecret } from "@/lib/crypto"

type ActionState = { ok?: boolean; message?: string } | undefined

async function audit(actorId: string, action: string, target: string, meta: Record<string, unknown>) {
  await db.insert(auditLogs).values({ actorId, action, target, meta })
}

async function hasStoredSecret(provider: "ENTRA" | "GITHUB") {
  const rows = await db
    .select({ token: ssoProviders.encryptedSecret })
    .from(ssoProviders)
    .where(eq(ssoProviders.provider, provider))
    .limit(1)
  return Boolean(rows[0]?.token)
}

export async function saveEntra(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin()
  const clientId = String(formData.get("clientId") ?? "").trim()
  const tenantId = String(formData.get("tenantId") ?? "").trim()
  const secret = String(formData.get("secret") ?? "").trim()
  const enabled = formData.get("enabled") === "on"

  if (enabled && (!clientId || (!secret && !(await hasStoredSecret("ENTRA"))))) {
    return { ok: false, message: "Client ID and secret are required to enable Entra ID SSO." }
  }
  const config = { clientId, tenantId }
  await db
    .insert(ssoProviders)
    .values({
      provider: "ENTRA",
      enabled,
      config,
      encryptedSecret: secret ? encryptSecret(secret) : null,
      updatedById: admin.id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: ssoProviders.provider,
      set: {
        enabled,
        config,
        ...(secret ? { encryptedSecret: encryptSecret(secret) } : {}),
        updatedById: admin.id,
        updatedAt: new Date(),
      },
    })
  await audit(admin.id, "sso.save", "ENTRA", { enabled, tenantId, secretUpdated: Boolean(secret) })
  revalidatePath("/settings")
  revalidatePath("/login")
  return { ok: true, message: enabled ? "Entra ID SSO saved and enabled." : "Entra ID SSO saved (disabled)." }
}

export async function saveGithubOauth(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin()
  const clientId = String(formData.get("clientId") ?? "").trim()
  const secret = String(formData.get("secret") ?? "").trim()
  const enabled = formData.get("enabled") === "on"

  if (enabled && (!clientId || (!secret && !(await hasStoredSecret("GITHUB"))))) {
    return { ok: false, message: "Client ID and secret are required to enable GitHub OAuth." }
  }
  const config = { clientId }
  await db
    .insert(ssoProviders)
    .values({
      provider: "GITHUB",
      enabled,
      config,
      encryptedSecret: secret ? encryptSecret(secret) : null,
      updatedById: admin.id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: ssoProviders.provider,
      set: {
        enabled,
        config,
        ...(secret ? { encryptedSecret: encryptSecret(secret) } : {}),
        updatedById: admin.id,
        updatedAt: new Date(),
      },
    })
  await audit(admin.id, "sso.save", "GITHUB", { enabled, secretUpdated: Boolean(secret) })
  revalidatePath("/settings")
  revalidatePath("/login")
  return { ok: true, message: enabled ? "GitHub OAuth saved and enabled." : "GitHub OAuth saved (disabled)." }
}
