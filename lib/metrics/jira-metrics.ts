import "server-only"
import { inArray } from "drizzle-orm"
import { db } from "@/db"
import { jiraIssues, jiraSprints, jiraTransitions } from "@/db/schema"
import { computeFlow, computeVelocity, computeFeatureCycle, type FlowResult, type VelocityResult, type FeatureCycleResult } from "./flow-compute"
import { computeQuality, type QualityResult } from "./quality-compute"
import { computeAllocation, type AllocResult } from "./allocation-compute"
import { getMetricConfig } from "./config-store"
import type { TeamFilter } from "@/lib/teams/types"

/** Compute Jira flow + velocity + quality + allocation metrics from ingested data (DB-backed). Optional team filter. */
export async function computeJiraMetrics(
  now = new Date(),
  filter?: TeamFilter | null
): Promise<{ flow: FlowResult; velocity: VelocityResult; quality: QualityResult; allocation: AllocResult; feature: FeatureCycleResult }> {
  const jiraKeys = filter?.jiraProjectKeys
  // A team with no Jira keys has no Jira-derived metrics.
  if (filter && (!jiraKeys || jiraKeys.length === 0)) {
    return { flow: { hasData: false }, velocity: { hasData: false }, quality: { hasData: false }, allocation: { hasData: false }, feature: { hasData: false } }
  }
  const teamIssueWhere = jiraKeys ? inArray(jiraIssues.projectKey, jiraKeys) : undefined
  const [issues, allSprints, allTransitions] = await Promise.all([
    db
      .select({
        key: jiraIssues.id,
        summary: jiraIssues.summary,
        issueType: jiraIssues.issueType,
        labels: jiraIssues.labels,
        status: jiraIssues.status,
        statusCategory: jiraIssues.statusCategory,
        storyPoints: jiraIssues.storyPoints,
        sprintId: jiraIssues.sprintId,
        programIncrement: jiraIssues.programIncrement,
        rootCause: jiraIssues.rootCause,
        defectEnv: jiraIssues.defectEnv,
        createdAt: jiraIssues.createdAt,
        inProgressAt: jiraIssues.inProgressAt,
        resolvedAt: jiraIssues.resolvedAt,
        blockedSeconds: jiraIssues.blockedSeconds,
      })
      .from(jiraIssues)
      .where(teamIssueWhere),
    db
      .select({
        id: jiraSprints.id,
        name: jiraSprints.name,
        state: jiraSprints.state,
        startDate: jiraSprints.startDate,
        completeDate: jiraSprints.completeDate,
      })
      .from(jiraSprints),
    db
      .select({
        issueKey: jiraTransitions.issueKey,
        toStatus: jiraTransitions.toStatus,
        at: jiraTransitions.at,
      })
      .from(jiraTransitions),
  ])
  // Scope sprints/transitions to the team (issues are already filtered via WHERE).
  let sprints = allSprints
  let transitions = allTransitions
  if (jiraKeys) {
    const keySet = new Set(jiraKeys)
    const teamSprintIds = new Set(issues.map((i) => i.sprintId).filter((x): x is number => x != null))
    sprints = allSprints.filter((s) => teamSprintIds.has(s.id))
    transitions = allTransitions.filter((t) => t.issueKey != null && keySet.has(t.issueKey.split("-")[0]))
  }
  // Exclude Sub-tasks from flow/velocity/allocation — they are implementation
  // details under Stories, not delivery units, and would double-count.
  const isSubtask = (t: string | null) => /sub-?task/i.test(t ?? "")
  const flowIssues = issues.filter((i) => !isSubtask(i.issueType))
  const flowKeys = new Set(flowIssues.map((i) => i.key))
  const flowTransitions = transitions.filter((t) => t.issueKey != null && flowKeys.has(t.issueKey))

  const qualityRows = issues.map((i) => ({ issueType: i.issueType, labels: (i.labels as string[] | null) ?? null, rootCause: i.rootCause, defectEnv: i.defectEnv }))
  const allocRows = flowIssues.map((i) => ({
    issueType: i.issueType,
    labels: (i.labels as string[] | null) ?? null,
    storyPoints: i.storyPoints,
  }))
  const mc = await getMetricConfig(filter?.slug)
  return {
    flow: computeFlow(flowIssues, now, flowTransitions, mc.blockedStatuses, mc.ageExcludedStatuses),
    velocity: computeVelocity(sprints, flowIssues),
    quality: computeQuality(qualityRows),
    allocation: computeAllocation(allocRows),
    feature: computeFeatureCycle(issues),
  }
}
