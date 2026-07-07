import "server-only"
import { db } from "@/db"
import { jiraIssues, jiraSprints } from "@/db/schema"
import { computeFlow, computeVelocity, type FlowResult, type VelocityResult } from "./flow-compute"
import { computeQuality, type QualityResult } from "./quality-compute"
import { computeAllocation, type AllocResult } from "./allocation-compute"

/** Compute Jira flow + velocity + quality + allocation metrics from ingested data (DB-backed). */
export async function computeJiraMetrics(
  now = new Date()
): Promise<{ flow: FlowResult; velocity: VelocityResult; quality: QualityResult; allocation: AllocResult }> {
  const [issues, sprints] = await Promise.all([
    db
      .select({
        issueType: jiraIssues.issueType,
        labels: jiraIssues.labels,
        statusCategory: jiraIssues.statusCategory,
        storyPoints: jiraIssues.storyPoints,
        sprintId: jiraIssues.sprintId,
        createdAt: jiraIssues.createdAt,
        inProgressAt: jiraIssues.inProgressAt,
        resolvedAt: jiraIssues.resolvedAt,
        blockedSeconds: jiraIssues.blockedSeconds,
      })
      .from(jiraIssues),
    db
      .select({
        id: jiraSprints.id,
        state: jiraSprints.state,
        startDate: jiraSprints.startDate,
        completeDate: jiraSprints.completeDate,
      })
      .from(jiraSprints),
  ])
  const qualityRows = issues.map((i) => ({ issueType: i.issueType, labels: (i.labels as string[] | null) ?? null }))
  const allocRows = issues.map((i) => ({
    issueType: i.issueType,
    labels: (i.labels as string[] | null) ?? null,
    storyPoints: i.storyPoints,
  }))
  return {
    flow: computeFlow(issues, now),
    velocity: computeVelocity(sprints, issues),
    quality: computeQuality(qualityRows),
    allocation: computeAllocation(allocRows),
  }
}
