import "server-only"
import { and, gte, isNotNull, eq, inArray } from "drizzle-orm"
import { db } from "@/db"
import { gitlabDeployments, gitlabMergeRequests, gitlabIncidents, integrations } from "@/db/schema"
import { computeDoraFromRows, computeIncidentMttr, type DoraResult } from "./dora-compute"
import { getMetricConfig } from "./config-store"
import type { TeamFilter } from "@/lib/teams/types"

export type { DoraMetric, DoraResult, DeploymentRow } from "./dora-compute"
export { computeDoraFromRows } from "./dora-compute"

/** Compute DORA from ingested GitLab production deployments (DB-backed). Optional team filter. */
export async function computeDora(now = new Date(), filter?: TeamFilter | null): Promise<DoraResult> {
  // The configurable rolling window drives both the DB fetch and the compute window.
  const mc = await getMetricConfig(filter?.slug)
  const since = new Date(now.getTime() - mc.windowWeeks * 7 * 864e5)
  const glPaths = filter?.gitlabProjectPaths
  // A team with no GitLab projects has no DORA data.
  if (filter && (!glPaths || glPaths.length === 0)) {
    return { hasData: false, deploymentsTotal: 0, windowWeeks: mc.windowWeeks }
  }
  const teamDep = glPaths ? inArray(gitlabDeployments.projectPath, glPaths) : undefined
  const teamMr = glPaths ? inArray(gitlabMergeRequests.projectPath, glPaths) : undefined
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
      .where(and(gte(gitlabDeployments.finishedAt, since), isNotNull(gitlabDeployments.finishedAt), teamDep)),
    db
      .select({ mergeCommitSha: gitlabMergeRequests.mergeCommitSha, firstCommitAt: gitlabMergeRequests.firstCommitAt })
      .from(gitlabMergeRequests)
      .where(and(isNotNull(gitlabMergeRequests.firstCommitAt), teamMr)),
    db.select({ config: integrations.config }).from(integrations).where(eq(integrations.provider, "GITLAB")).limit(1),
  ])
  const leadTimeMode = ((cfgRow[0]?.config as { leadTimeMode?: string })?.leadTimeMode === "gitops"
    ? "gitops"
    : "mr") as "mr" | "gitops"
  const result = computeDoraFromRows(rows, now, {
    mrs,
    leadTimeMode,
    windowWeeks: mc.windowWeeks,
    deployment: mc.deployment,
  })

  // Optional: replace the deploy-recovery proxy MTTR with real incident recovery time.
  if (mc.mttrMode === "incident" && result.hasData) {
    const teamInc = glPaths ? inArray(gitlabIncidents.projectPath, glPaths) : undefined
    const incidents = await db
      .select({ createdAt: gitlabIncidents.createdAt, closedAt: gitlabIncidents.closedAt })
      .from(gitlabIncidents)
      .where(and(isNotNull(gitlabIncidents.closedAt), teamInc))
    const inc = computeIncidentMttr(incidents, now, mc.windowWeeks)
    if (inc) result.mttr = { ...inc, note: "Incident-based MTTR — GitLab incidents (close − open)." }
  }
  return result
}
