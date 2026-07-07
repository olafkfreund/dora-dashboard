import "server-only"
import { and, gte, isNotNull } from "drizzle-orm"
import { db } from "@/db"
import { gitlabDeployments, gitlabMergeRequests } from "@/db/schema"
import { computePrCycle, type PrCycleResult } from "./pr-cycle-compute"

/** PR (merge-request) cycle-time breakdown from ingested GitLab data (DB-backed). */
export async function computePrCycleMetric(now = new Date()): Promise<PrCycleResult> {
  const since = new Date(now.getTime() - 8 * 7 * 864e5)
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
      .where(gte(gitlabMergeRequests.mergedAt, since)),
    db
      .select({ sha: gitlabDeployments.sha, finishedAt: gitlabDeployments.finishedAt })
      .from(gitlabDeployments)
      .where(and(isNotNull(gitlabDeployments.sha), isNotNull(gitlabDeployments.finishedAt))),
  ])
  const deployBySha = new Map<string, Date>()
  for (const d of deps) {
    if (!d.sha || !d.finishedAt) continue
    const cur = deployBySha.get(d.sha)
    if (!cur || d.finishedAt < cur) deployBySha.set(d.sha, d.finishedAt)
  }
  return computePrCycle(mrs, deployBySha, now)
}
