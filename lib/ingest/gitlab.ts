import "server-only"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { gitlabDeployments, gitlabMergeRequests, syncState, integrations } from "@/db/schema"
import { getGitlabConfig, gitlabPaginate, listProjects, type GitlabConfig } from "@/lib/gitlab"

export interface SyncResult {
  ok: boolean
  message: string
  projects?: number
  deployments?: number
  mergeRequests?: number
}

const PROD_ENV = "production"

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

async function setCursor(id: string, provider: string, entity: string, cursor: string, itemCount: number, error?: string) {
  await db
    .insert(syncState)
    .values({ id, provider, entity, cursor, lastSyncAt: new Date(), lastError: error ?? null, itemCount })
    .onConflictDoUpdate({
      target: syncState.id,
      set: { cursor, lastSyncAt: new Date(), lastError: error ?? null, itemCount },
    })
}

async function syncDeployments(cfg: GitlabConfig): Promise<number> {
  const cursorId = "GITLAB:deployments"
  const cursor = await getCursor(cursorId)
  const updatedAfter = cursor ?? new Date(Date.now() - 90 * 864e5).toISOString()
  const projects = await listProjects(cfg)
  let count = 0
  let maxUpdated = cursor ?? updatedAfter

  for (const project of projects) {
    const deps = await gitlabPaginate<GitlabDeployment>(
      cfg,
      `/projects/${project.id}/deployments`,
      { environment: PROD_ENV, order_by: "updated_at", sort: "desc", updated_after: updatedAfter },
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
          environment: d.environment?.name ?? PROD_ENV,
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

async function syncMergeRequests(cfg: GitlabConfig): Promise<number> {
  if (!cfg.group) return 0
  const cursorId = "GITLAB:merge_requests"
  const cursor = await getCursor(cursorId)
  const updatedAfter = cursor ?? new Date(Date.now() - 90 * 864e5).toISOString()
  const mrs = await gitlabPaginate<GitlabMergeRequest>(
    cfg,
    `/groups/${encodeURIComponent(cfg.group)}/merge_requests`,
    { state: "merged", order_by: "updated_at", sort: "desc", updated_after: updatedAfter },
    10
  )
  let maxUpdated = cursor ?? updatedAfter
  for (const mr of mrs) {
    await db
      .insert(gitlabMergeRequests)
      .values({
        id: `${mr.project_id}:${mr.iid}`,
        projectId: mr.project_id,
        iid: mr.iid,
        createdAt: toDate(mr.created_at),
        mergedAt: toDate(mr.merged_at),
        ingestedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: gitlabMergeRequests.id,
        set: { mergedAt: toDate(mr.merged_at), ingestedAt: new Date() },
      })
    if (mr.merged_at && mr.merged_at > maxUpdated) maxUpdated = mr.merged_at
  }
  await setCursor(cursorId, "GITLAB", "merge_requests", maxUpdated, mrs.length)
  return mrs.length
}

/** Incrementally ingest GitLab deployments + merged MRs into Postgres. */
export async function syncGitlab(): Promise<SyncResult> {
  const cfg = await getGitlabConfig()
  if (!cfg) return { ok: false, message: "GitLab is not configured — save a token in Settings first." }
  try {
    const projects = (await listProjects(cfg)).length
    const deployments = await syncDeployments(cfg)
    const mergeRequests = await syncMergeRequests(cfg)
    await db
      .update(integrations)
      .set({ status: "CONNECTED", lastSyncAt: new Date(), lastError: null })
      .where(eq(integrations.provider, "GITLAB"))
    return {
      ok: true,
      message: `Synced ${deployments} deployment(s) and ${mergeRequests} merge request(s) across ${projects} project(s).`,
      projects,
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
