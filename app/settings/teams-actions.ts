"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth-helpers"
import { writeAudit } from "@/lib/audit"
import { upsertTeam, deleteTeam } from "@/lib/teams/store"
import type { ActionState } from "@/lib/action-state"

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48)

export async function saveTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin()
  const name = String(formData.get("name") ?? "").trim()
  if (!name) return { ok: false, message: "Team name is required." }
  const slug = String(formData.get("slug") ?? "").trim() || slugify(name)
  if (!slug) return { ok: false, message: "Could not derive a slug from the name." }
  const gitlabProjects = formData.getAll("gitlabProjects").map(String)
  const jiraProjectKeys = formData.getAll("jiraProjectKeys").map(String)
  await upsertTeam(slug, name, { gitlabProjects, jiraProjectKeys }, admin.id)
  await writeAudit(admin.id, "team.save", slug, {
    name,
    gitlabProjects: gitlabProjects.length,
    jiraProjectKeys: jiraProjectKeys.length,
  })
  revalidatePath("/settings")
  revalidatePath("/")
  return { ok: true, message: `Saved team "${name}".` }
}

export async function deleteTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin()
  const slug = String(formData.get("slug") ?? "")
  if (!slug) return { ok: false, message: "Missing team." }
  await deleteTeam(slug)
  await writeAudit(admin.id, "team.delete", slug)
  revalidatePath("/settings")
  revalidatePath("/")
  return { ok: true, message: "Team deleted." }
}
