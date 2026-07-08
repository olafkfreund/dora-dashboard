import "server-only"
import { and, gte, isNotNull, inArray } from "drizzle-orm"
import { db } from "@/db"
import { gitlabDeployments, gitlabMergeRequests } from "@/db/schema"
import { computePrCycle, type PrCycleResult } from "./pr-cycle-compute"
import type { TeamFilter } from "@/lib/teams/types"

/** PR (merge-request) cycle-time breakdown from ingested GitLab data (DB-backed). Optional team filter. */
export async function computePrCycleMetric(now = new Date(), filter?: TeamFilter | null): Promise<PrCycleResult> {
  const since = new Date(now.getTime() - 8 * 7 * 864e5)
  const glPaths = filter?.gitlabProjectPaths
  if (filter && (!glPaths || glPaths.length === 0)) return { hasData: false }
  const teamMr = glPaths ? inArray(gitlabMergeRequests.projectPath, glPaths) : undefined
  const teamDep = glPaths ? inArray(gitlabDeployments.projectPath, glPaths) : undefined
  const [mrs, deps] = await Promise.all([
    db
      .select({
        firstCommitAt: gitlabMergeRequests.firstCommitAt,
        createdAt: gitlabMergeRequests.createdAt,
        firstReviewAt: gitlabMergeRequests.firstReviewAt,
        mergedAt: gitlabMergeRequests.mergedAt,
        mergeCommitSha: gitlabMergeRequests.mergeCommitSha,
      })
      .from(gitlabMergeRequests)
      .where(and(gte(gitlabMergeRequests.mergedAt, since), teamMr)),
    db
      .select({ sha: gitlabDeployments.sha, finishedAt: gitlabDeployments.finishedAt })
      .from(gitlabDeployments)
      .where(and(isNotNull(gitlabDeployments.sha), isNotNull(gitlabDeployments.finishedAt), teamDep)),
  ])
  const deployBySha = new Map<string, Date>()
  for (const d of deps) {
    if (!d.sha || !d.finishedAt) continue
    const cur = deployBySha.get(d.sha)
    if (!cur || d.finishedAt < cur) deployBySha.set(d.sha, d.finishedAt)
  }
  return computePrCycle(mrs, deployBySha, now)
}
