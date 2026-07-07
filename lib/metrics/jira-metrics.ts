import "server-only"
import { db } from "@/db"
import { jiraIssues, jiraSprints } from "@/db/schema"
import { computeFlow, computeVelocity, type FlowResult, type VelocityResult } from "./flow-compute"

/** Compute Jira flow + velocity metrics from ingested data (DB-backed). */
export async function computeJiraMetrics(
  now = new Date()
): Promise<{ flow: FlowResult; velocity: VelocityResult }> {
  const [issues, sprints] = await Promise.all([
    db
      .select({
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
  return { flow: computeFlow(issues, now), velocity: computeVelocity(sprints, issues) }
}
