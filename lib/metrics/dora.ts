import "server-only"
import { and, gte, isNotNull, eq, inArray, or, ilike } from "drizzle-orm"
import { db } from "@/db"
import { gitlabDeployments, gitlabMergeRequests, gitlabIncidents, jiraIssues, integrations } from "@/db/schema"
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

  // Change failures live in Jira (Incident issues + Production-environment defects),
  // not as GitLab "failed" deploy jobs. When that signal exists, use it for CFR — and
  // for incident-based MTTR — instead of the deploy-status proxy.
  if (result.hasData) {
    const jiraKeys = filter?.jiraProjectKeys
    const teamJira = jiraKeys ? inArray(jiraIssues.projectKey, jiraKeys) : undefined
    const candidates = await db
      .select({
        issueType: jiraIssues.issueType,
        defectEnv: jiraIssues.defectEnv,
        createdAt: jiraIssues.createdAt,
        resolvedAt: jiraIssues.resolvedAt,
      })
      .from(jiraIssues)
      .where(and(or(ilike(jiraIssues.issueType, "%incident%"), isNotNull(jiraIssues.defectEnv)), teamJira))
    const isProdDefect = (e: string | null) => !!e && /prod/i.test(e) && !/non.?prod|pre.?prod/i.test(e)
    const failures = candidates.filter((r) => /incident/i.test(r.issueType ?? "") || isProdDefect(r.defectEnv))

    if (failures.length) {
      const inWin = failures.filter((f) => f.createdAt && f.createdAt >= since)
      const deploys = result.deploymentsTotal
      const pct = deploys ? Math.round((inWin.length / deploys) * 1000) / 10 : 0
      result.changeFailureRate = {
        value: `${pct}%`,
        sub: `${inWin.length} prod incidents/defects · ${deploys} deploys`,
        history: [],
        trend: "flat",
        note: "Change failures = Jira Incidents + Production-environment defects in the window ÷ production deployments. GitLab deploy-job status showed no failures, so that proxy would read 0%.",
      }
      // Use incident MTTR when configured, or whenever the deploy-recovery proxy
      // produced nothing (no failed deploys) — better than showing a sample value.
      if (mc.mttrMode === "incident" || !result.mttr) {
        const inc = computeIncidentMttr(
          failures.map((f) => ({ createdAt: f.createdAt, closedAt: f.resolvedAt })),
          now,
          mc.windowWeeks
        )
        if (inc) result.mttr = { ...inc, note: "Incident-based MTTR — Jira Incidents + Production defects (resolved − created)." }
      }
    } else if (mc.mttrMode === "incident") {
      // No Jira failure signal — fall back to GitLab incident management if present.
      const teamInc = glPaths ? inArray(gitlabIncidents.projectPath, glPaths) : undefined
      const incidents = await db
        .select({ createdAt: gitlabIncidents.createdAt, closedAt: gitlabIncidents.closedAt })
        .from(gitlabIncidents)
        .where(and(isNotNull(gitlabIncidents.closedAt), teamInc))
      const inc = computeIncidentMttr(incidents, now, mc.windowWeeks)
      if (inc) result.mttr = { ...inc, note: "Incident-based MTTR — GitLab incidents (close − open)." }
    }
  }
  return result
}
