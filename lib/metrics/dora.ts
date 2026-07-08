import "server-only"
import { and, gte, isNotNull, eq } from "drizzle-orm"
import { db } from "@/db"
import { gitlabDeployments, gitlabMergeRequests, integrations } from "@/db/schema"
import { computeDoraFromRows, type DoraResult } from "./dora-compute"
import { getMetricConfig } from "./config-store"

export type { DoraMetric, DoraResult, DeploymentRow } from "./dora-compute"
export { computeDoraFromRows } from "./dora-compute"

/** Compute DORA from ingested GitLab production deployments (DB-backed). */
export async function computeDora(now = new Date()): Promise<DoraResult> {
  // The configurable rolling window drives both the DB fetch and the compute window.
  const mc = await getMetricConfig()
  const since = new Date(now.getTime() - mc.windowWeeks * 7 * 864e5)
  const [rows, mrs, cfgRow] = await Promise.all([
    db
      .select({
        projectId: gitlabDeployments.projectId,
        status: gitlabDeployments.status,
        finishedAt: gitlabDeployments.finishedAt,
        committedAt: gitlabDeployments.committedAt,
        sha: gitlabDeployments.sha,
        environment: gitlabDeployments.environment,
        ref: gitlabDeployments.ref,
      })
      .from(gitlabDeployments)
      .where(and(gte(gitlabDeployments.finishedAt, since), isNotNull(gitlabDeployments.finishedAt))),
    db
      .select({ mergeCommitSha: gitlabMergeRequests.mergeCommitSha, firstCommitAt: gitlabMergeRequests.firstCommitAt })
      .from(gitlabMergeRequests)
      .where(isNotNull(gitlabMergeRequests.firstCommitAt)),
    db.select({ config: integrations.config }).from(integrations).where(eq(integrations.provider, "GITLAB")).limit(1),
  ])
  const leadTimeMode = ((cfgRow[0]?.config as { leadTimeMode?: string })?.leadTimeMode === "gitops"
    ? "gitops"
    : "mr") as "mr" | "gitops"
  return computeDoraFromRows(rows, now, {
    mrs,
    leadTimeMode,
    windowWeeks: mc.windowWeeks,
    deployment: mc.deployment,
  })
}
