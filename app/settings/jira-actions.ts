"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth-helpers"
import { writeAudit } from "@/lib/audit"
import { syncJira } from "@/lib/ingest/jira"
import type { ActionState } from "@/lib/action-state"

export async function syncJiraAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin()
  const result = await syncJira()
  await writeAudit(admin.id, "integration.sync", "JIRA", {
    ok: result.ok,
    issues: result.issues ?? 0,
    sprints: result.sprints ?? 0,
  })
  revalidatePath("/settings")
  revalidatePath("/")
  return { ok: result.ok, message: result.message }
}
