"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth-helpers"
import { db } from "@/db"
import { ssoProviders } from "@/db/schema"
import { encryptSecret } from "@/lib/crypto"
import { writeAudit } from "@/lib/audit"
import type { ActionState } from "@/lib/action-state"

type SsoProvider = "ENTRA" | "GITHUB"

async function hasStoredSecret(provider: SsoProvider) {
  const rows = await db
    .select({ token: ssoProviders.encryptedSecret })
    .from(ssoProviders)
    .where(eq(ssoProviders.provider, provider))
    .limit(1)
  return Boolean(rows[0]?.token)
}

/** Upsert a single-row SSO config, encrypting the secret only when a new one is given. */
async function upsertSso(
  actorId: string,
  provider: SsoProvider,
  config: Record<string, string>,
  secret: string,
  enabled: boolean
) {
  const encrypted = secret ? { encryptedSecret: encryptSecret(secret) } : {}
  await db
    .insert(ssoProviders)
    .values({
      provider,
      enabled,
      config,
      encryptedSecret: secret ? encryptSecret(secret) : null,
      updatedById: actorId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: ssoProviders.provider,
      set: { enabled, config, ...encrypted, updatedById: actorId, updatedAt: new Date() },
    })
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
  await upsertSso(admin.id, "ENTRA", { clientId, tenantId }, secret, enabled)
  await writeAudit(admin.id, "sso.save", "ENTRA", { enabled, tenantId, secretUpdated: Boolean(secret) })
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
  await upsertSso(admin.id, "GITHUB", { clientId }, secret, enabled)
  await writeAudit(admin.id, "sso.save", "GITHUB", { enabled, secretUpdated: Boolean(secret) })
  revalidatePath("/settings")
  revalidatePath("/login")
  return { ok: true, message: enabled ? "GitHub OAuth saved and enabled." : "GitHub OAuth saved (disabled)." }
}
