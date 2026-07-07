"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth-helpers"
import { db } from "@/db"
import { integrations } from "@/db/schema"
import { encryptSecret, decryptSecret } from "@/lib/crypto"
import { writeAudit } from "@/lib/audit"
import type { ActionState } from "@/lib/action-state"

type IntegrationProvider = "GITHUB" | "GITLAB" | "JIRA"

/** Upsert a single-row integration config, encrypting the token only when a new one is given. */
async function upsertIntegration(
  actorId: string,
  provider: IntegrationProvider,
  config: Record<string, string>,
  token: string
) {
  const encrypted = token ? { encryptedToken: encryptSecret(token) } : {}
  await db
    .insert(integrations)
    .values({
      provider,
      status: "CONNECTED",
      config,
      encryptedToken: token ? encryptSecret(token) : null,
      updatedById: actorId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: integrations.provider,
      set: { status: "CONNECTED", config, ...encrypted, updatedById: actorId, updatedAt: new Date() },
    })
}

export async function saveGithub(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin()
  const org = String(formData.get("org") ?? "").trim()
  const token = String(formData.get("token") ?? "").trim()
  await upsertIntegration(admin.id, "GITHUB", { org, authMode: "pat" }, token)
  await writeAudit(admin.id, "integration.save", "GITHUB", { org, tokenUpdated: Boolean(token) })
  revalidatePath("/settings")
  return { ok: true, message: "GitHub integration saved." }
}

export async function saveGitlab(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin()
  const baseUrl = String(formData.get("baseUrl") ?? "").trim() || "https://gitlab.com"
  const group = String(formData.get("group") ?? "").trim()
  const prodEnv = String(formData.get("prodEnv") ?? "").trim() || "production"
  const token = String(formData.get("token") ?? "").trim()
  await upsertIntegration(admin.id, "GITLAB", { baseUrl, group, prodEnv }, token)
  await writeAudit(admin.id, "integration.save", "GITLAB", { baseUrl, group, prodEnv, tokenUpdated: Boolean(token) })
  revalidatePath("/settings")
  return { ok: true, message: "GitLab integration saved." }
}

export async function saveJira(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin()
  const baseUrl = String(formData.get("baseUrl") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim()
  const token = String(formData.get("token") ?? "").trim()
  await upsertIntegration(admin.id, "JIRA", { baseUrl, email }, token)
  await writeAudit(admin.id, "integration.save", "JIRA", { baseUrl, tokenUpdated: Boolean(token) })
  revalidatePath("/settings")
  return { ok: true, message: "Jira integration saved." }
}

export async function testConnection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin()
  const provider = String(formData.get("provider") ?? "") as IntegrationProvider
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
    const cfg = (row.config ?? {}) as { baseUrl?: string; email?: string }
    if (provider === "GITHUB") {
      const res = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token}`, "User-Agent": "dora-dashboard" },
      })
      ok = res.ok
      detail = ok ? `Connected as ${(await res.json()).login}` : `GitHub returned ${res.status}`
    } else if (provider === "GITLAB") {
      const base = (cfg.baseUrl || "https://gitlab.com").replace(/\/$/, "")
      const res = await fetch(`${base}/api/v4/user`, {
        headers: { "PRIVATE-TOKEN": token, Accept: "application/json" },
      })
      ok = res.ok
      detail = ok ? `Connected as ${(await res.json()).username}` : `GitLab returned ${res.status}`
    } else {
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
