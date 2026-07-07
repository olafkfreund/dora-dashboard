import "server-only"
import { eq, and, isNull, isNotNull } from "drizzle-orm"
import { db } from "@/db"
import { gitlabDeployments, gitlabMergeRequests, syncState, integrations } from "@/db/schema"
import {
  getGitlabConfig,
  getCommitDate,
  gitlabPaginate,
  listProjects,
  type GitlabConfig,
  type GitlabProject,
} from "@/lib/gitlab"

// Max commit lookups per sync (for Lead Time backfill).
const COMMIT_BACKFILL_LIMIT = 500

export interface SyncResult {
  ok: boolean
  message: string
  projects?: number
  deployments?: number
  mergeRequests?: number
}

interface GitlabDeployment {
  id: number
  ref?: string
  sha?: string
  status?: string
  created_at?: string
  updated_at?: string
  environment?: { name?: string }
  deployable?: { finished_at?: string }
}

interface GitlabMergeRequest {
  id: number
  iid: number
  project_id: number
  created_at?: string
  merged_at?: string
}

function toDate(s?: string | null): Date | null {
  return s ? new Date(s) : null
}

async function getCursor(id: string): Promise<string | undefined> {
  const rows = await db.select().from(syncState).where(eq(syncState.id, id)).limit(1)
  return rows[0]?.cursor ?? undefined
}

async function setCursor(id: string, provider: string, entity: string, cursor: string, itemCount: number) {
  await db
    .insert(syncState)
    .values({ id, provider, entity, cursor, lastSyncAt: new Date(), lastError: null, itemCount })
    .onConflictDoUpdate({
      target: syncState.id,
      set: { cursor, lastSyncAt: new Date(), lastError: null, itemCount },
    })
}

async function syncDeployments(cfg: GitlabConfig, projects: GitlabProject[]): Promise<number> {
  const cursorId = "GITLAB:deployments"
  const cursor = await getCursor(cursorId)
  const updatedAfter = cursor ?? new Date(Date.now() - 90 * 864e5).toISOString()
  let count = 0
  let maxUpdated = cursor ?? updatedAfter

  for (const project of projects) {
    const deps = await gitlabPaginate<GitlabDeployment>(
      cfg,
      `/projects/${project.id}/deployments`,
      { environment: cfg.prodEnv, order_by: "updated_at", sort: "desc", updated_after: updatedAfter },
      10
    )
    for (const d of deps) {
      const finished = toDate(d.deployable?.finished_at) ?? toDate(d.updated_at)
      await db
        .insert(gitlabDeployments)
        .values({
          id: `${project.id}:${d.id}`,
          projectId: project.id,
          deploymentId: d.id,
          projectPath: project.path_with_namespace,
          environment: d.environment?.name ?? cfg.prodEnv,
          status: d.status,
          ref: d.ref,
          sha: d.sha,
          createdAt: toDate(d.created_at),
          finishedAt: finished,
          ingestedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: gitlabDeployments.id,
          set: { status: d.status, finishedAt: finished, ingestedAt: new Date() },
        })
      count++
      if (d.updated_at && d.updated_at > maxUpdated) maxUpdated = d.updated_at
    }
  }
  await setCursor(cursorId, "GITLAB", "deployments", maxUpdated, count)
  return count
}

async function syncMergeRequests(cfg: GitlabConfig, projects: GitlabProject[]): Promise<number> {
  const cursorId = "GITLAB:merge_requests"
  const cursor = await getCursor(cursorId)
  const updatedAfter = cursor ?? new Date(Date.now() - 90 * 864e5).toISOString()
  let count = 0
  let maxUpdated = cursor ?? updatedAfter

  for (const project of projects) {
    const mrs = await gitlabPaginate<GitlabMergeRequest>(
      cfg,
      `/projects/${project.id}/merge_requests`,
      { state: "merged", order_by: "updated_at", sort: "desc", updated_after: updatedAfter },
      5
    )
    for (const mr of mrs) {
      await db
        .insert(gitlabMergeRequests)
        .values({
          id: `${project.id}:${mr.iid}`,
          projectId: project.id,
          iid: mr.iid,
          projectPath: project.path_with_namespace,
          createdAt: toDate(mr.created_at),
          mergedAt: toDate(mr.merged_at),
          ingestedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: gitlabMergeRequests.id,
          set: { mergedAt: toDate(mr.merged_at), ingestedAt: new Date() },
        })
      count++
      if (mr.merged_at && mr.merged_at > maxUpdated) maxUpdated = mr.merged_at
    }
  }
  await setCursor(cursorId, "GITLAB", "merge_requests", maxUpdated, count)
  return count
}

/** Fill committedAt (deployed commit's date) for deployments missing it — for Lead Time. */
async function backfillCommitDates(cfg: GitlabConfig): Promise<number> {
  const rows = await db
    .select({ id: gitlabDeployments.id, projectId: gitlabDeployments.projectId, sha: gitlabDeployments.sha })
    .from(gitlabDeployments)
    .where(and(isNull(gitlabDeployments.committedAt), isNotNull(gitlabDeployments.sha)))
    .limit(COMMIT_BACKFILL_LIMIT)
  let count = 0
  for (const r of rows) {
    if (!r.sha) continue
    const committedAt = await getCommitDate(cfg, r.projectId, r.sha)
    if (committedAt) {
      await db.update(gitlabDeployments).set({ committedAt }).where(eq(gitlabDeployments.id, r.id))
      count++
    }
  }
  return count
}

/** Incrementally ingest GitLab production deployments + merged MRs into Postgres. */
export async function syncGitlab(): Promise<SyncResult> {
  const cfg = await getGitlabConfig()
  if (!cfg) return { ok: false, message: "GitLab is not configured — save a token in Settings first." }
  try {
    const projects = await listProjects(cfg)
    if (projects.length === 0) {
      return {
        ok: false,
        message: `No projects found for "${cfg.target ?? "(membership)"}". Check the group/project path and the token's read_api scope.`,
      }
    }
    const deployments = await syncDeployments(cfg, projects)
    const mergeRequests = await syncMergeRequests(cfg, projects)
    const commitsBackfilled = await backfillCommitDates(cfg)
    await db
      .update(integrations)
      .set({ status: "CONNECTED", lastSyncAt: new Date(), lastError: null })
      .where(eq(integrations.provider, "GITLAB"))
    return {
      ok: true,
      message: `Synced ${deployments} '${cfg.prodEnv}' deployment(s), ${mergeRequests} merge request(s), ${commitsBackfilled} commit date(s) across ${projects.length} project(s).`,
      projects: projects.length,
      deployments,
      mergeRequests,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed"
    await db
      .update(integrations)
      .set({ status: "ERROR", lastError: message })
      .where(eq(integrations.provider, "GITLAB"))
    return { ok: false, message }
  }
}
