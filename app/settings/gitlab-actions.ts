"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth-helpers"
import { writeAudit } from "@/lib/audit"
import { syncGitlab } from "@/lib/ingest/gitlab"
import type { ActionState } from "@/lib/action-state"

export async function syncGitlabAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin()
  const result = await syncGitlab()
  await writeAudit(admin.id, "integration.sync", "GITLAB", {
    ok: result.ok,
    deployments: result.deployments ?? 0,
    mergeRequests: result.mergeRequests ?? 0,
  })
  revalidatePath("/settings")
  revalidatePath("/")
  return { ok: result.ok, message: result.message }
}
