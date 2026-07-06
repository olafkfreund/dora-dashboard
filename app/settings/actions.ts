"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth-helpers"
import { db } from "@/db"
import { integrations, auditLogs } from "@/db/schema"
import { encryptSecret, decryptSecret } from "@/lib/crypto"

type ActionState = { ok?: boolean; message?: string } | undefined

async function writeAudit(
  actorId: string,
  action: string,
  target: string,
  meta: Record<string, unknown>
) {
  await db.insert(auditLogs).values({ actorId, action, target, meta })
}

export async function saveGithub(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin()
  const org = String(formData.get("org") ?? "").trim()
  const token = String(formData.get("token") ?? "").trim()
  const config = { org, authMode: "pat" as const }

  await db
    .insert(integrations)
    .values({
      provider: "GITHUB",
      status: "CONNECTED",
      config,
      encryptedToken: token ? encryptSecret(token) : null,
      updatedById: admin.id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: integrations.provider,
      set: {
        status: "CONNECTED",
        config,
        ...(token ? { encryptedToken: encryptSecret(token) } : {}),
        updatedById: admin.id,
        updatedAt: new Date(),
      },
    })

  await writeAudit(admin.id, "integration.save", "GITHUB", {
    org,
    tokenUpdated: Boolean(token),
  })
  revalidatePath("/settings")
  return { ok: true, message: "GitHub integration saved." }
}

export async function saveJira(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin()
  const baseUrl = String(formData.get("baseUrl") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim()
  const token = String(formData.get("token") ?? "").trim()
  const config = { baseUrl, email }

  await db
    .insert(integrations)
    .values({
      provider: "JIRA",
      status: "CONNECTED",
      config,
      encryptedToken: token ? encryptSecret(token) : null,
      updatedById: admin.id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: integrations.provider,
      set: {
        status: "CONNECTED",
        config,
        ...(token ? { encryptedToken: encryptSecret(token) } : {}),
        updatedById: admin.id,
        updatedAt: new Date(),
      },
    })

  await writeAudit(admin.id, "integration.save", "JIRA", {
    baseUrl,
    tokenUpdated: Boolean(token),
  })
  revalidatePath("/settings")
  return { ok: true, message: "Jira integration saved." }
}

export async function testConnection(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin()
  const provider = String(formData.get("provider") ?? "") as "GITHUB" | "JIRA"
  const rows = await db
    .select()
    .from(integrations)
    .where(eq(integrations.provider, provider))
    .limit(1)
  const row = rows[0]
  if (!row?.encryptedToken) {
    return { ok: false, message: "No token stored — save one first." }
  }

  let ok = false
  let detail = ""
  try {
    const token = decryptSecret(row.encryptedToken)
    if (provider === "GITHUB") {
      const res = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token}`, "User-Agent": "dora-dashboard" },
      })
      ok = res.ok
      detail = ok ? `Connected as ${(await res.json()).login}` : `GitHub returned ${res.status}`
    } else {
      const cfg = (row.config ?? {}) as { baseUrl?: string; email?: string }
      const base = (cfg.baseUrl ?? "").replace(/\/$/, "")
      const auth = Buffer.from(`${cfg.email}:${token}`).toString("base64")
      const res = await fetch(`${base}/rest/api/3/myself`, {
        headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      })
      ok = res.ok
      detail = ok ? `Connected as ${(await res.json()).displayName}` : `Jira returned ${res.status}`
    }
  } catch (e) {
    ok = false
    detail = e instanceof Error ? e.message : "Connection failed"
  }

  await db
    .update(integrations)
    .set({
      status: ok ? "CONNECTED" : "ERROR",
      lastError: ok ? null : detail,
      lastSyncAt: ok ? new Date() : row.lastSyncAt,
    })
    .where(eq(integrations.provider, provider))
  await writeAudit(admin.id, "integration.test", provider, { ok, detail })
  revalidatePath("/settings")
  return { ok, message: detail }
}
