"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth-helpers"
import { writeAudit } from "@/lib/audit"
import { saveDigestConfig } from "@/lib/digest/store"
import { sendDigest } from "@/lib/digest/send"
import type { DigestChannel } from "@/lib/digest/types"
import type { ActionState } from "@/lib/action-state"

export async function saveDigestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin()
  const channel = (String(formData.get("channel")) === "email" ? "email" : "webhook") as DigestChannel
  const teamRaw = String(formData.get("teamSlug") ?? "")
  const input = {
    enabled: formData.get("enabled") === "on",
    channel,
    to: String(formData.get("to") ?? "").trim(),
    from: String(formData.get("from") ?? "").trim() || "dora-dashboard@localhost",
    smtpHost: String(formData.get("smtpHost") ?? "").trim(),
    smtpPort: Number(formData.get("smtpPort")) || 587,
    smtpUser: String(formData.get("smtpUser") ?? "").trim(),
    secure: formData.get("secure") === "on",
    teamSlug: teamRaw === "" || teamRaw === "all" ? null : teamRaw,
    includePdf: formData.get("includePdf") === "on",
  }
  const secretRaw = String(formData.get("secret") ?? "").trim()
  await saveDigestConfig(input, secretRaw === "" ? undefined : secretRaw, admin.id)
  await writeAudit(admin.id, "digest.save", channel, { enabled: input.enabled, teamSlug: input.teamSlug })
  revalidatePath("/settings")
  return { ok: true, message: "Digest settings saved." }
}

export async function testDigestAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin()
  const res = await sendDigest({ test: true })
  await writeAudit(admin.id, "digest.test", "manual", { ok: res.ok })
  return { ok: res.ok, message: res.message }
}
