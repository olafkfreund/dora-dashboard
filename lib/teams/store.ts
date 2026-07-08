import "server-only"
import { eq, asc } from "drizzle-orm"
import { db } from "@/db"
import { teams, gitlabDeployments, jiraIssues } from "@/db/schema"
import { normalizeTeamConfig, type TeamConfig, type TeamRecord, type TeamFilter } from "./types"

export async function listTeams(): Promise<TeamRecord[]> {
  const rows = await db.select().from(teams).orderBy(asc(teams.name))
  return rows.map((r) => ({ slug: r.slug, name: r.name, config: normalizeTeamConfig(r.config) }))
}

export async function getTeam(slug: string): Promise<TeamRecord | null> {
  const rows = await db.select().from(teams).where(eq(teams.slug, slug)).limit(1)
  const r = rows[0]
  return r ? { slug: r.slug, name: r.name, config: normalizeTeamConfig(r.config) } : null
}

export async function upsertTeam(slug: string, name: string, config: TeamConfig, updatedById?: string): Promise<void> {
  const now = new Date()
  await db
    .insert(teams)
    .values({ slug, name, config, updatedById, updatedAt: now })
    .onConflictDoUpdate({ target: teams.slug, set: { name, config, updatedById, updatedAt: now } })
}

export async function deleteTeam(slug: string): Promise<void> {
  await db.delete(teams).where(eq(teams.slug, slug))
}

/** Resolve a team slug to a compute filter, or null for "all teams" (org-level). */
export async function resolveTeamFilter(slug?: string | null): Promise<TeamFilter | null> {
  if (!slug || slug === "all") return null
  const team = await getTeam(slug)
  if (!team) return null
  return {
    slug: team.slug,
    name: team.name,
    gitlabProjectPaths: team.config.gitlabProjects,
    jiraProjectKeys: team.config.jiraProjectKeys,
  }
}

/** Distinct ingested GitLab project paths + Jira project keys — for the assignment UI. */
export async function distinctAssignables(): Promise<{ gitlabProjects: string[]; jiraProjectKeys: string[] }> {
  const [gl, jr] = await Promise.all([
    db.selectDistinct({ p: gitlabDeployments.projectPath }).from(gitlabDeployments),
    db.selectDistinct({ k: jiraIssues.projectKey }).from(jiraIssues),
  ])
  return {
    gitlabProjects: gl.map((r) => r.p).filter((x): x is string => !!x).sort(),
    jiraProjectKeys: jr.map((r) => r.k).filter((x): x is string => !!x).sort(),
  }
}
