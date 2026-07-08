import "server-only"
import { getJiraConfig } from "@/lib/jira"
import { getGitlabConfig } from "@/lib/gitlab"
import type { SourceLink } from "./breakdown"
import type { TeamFilter } from "@/lib/teams/types"

/**
 * Per-metric deep links into the source system (GitLab / Jira), so a card can jump to
 * the underlying items. Jira links are scoped to the selected team's project keys.
 */
export async function getSourceLinks(filter?: TeamFilter | null): Promise<Record<string, SourceLink>> {
  const [jira, gitlab] = await Promise.all([getJiraConfig(), getGitlabConfig()])
  const links: Record<string, SourceLink> = {}

  if (jira?.baseUrl) {
    const base = jira.baseUrl.replace(/\/$/, "")
    const keys = filter?.jiraProjectKeys
    const scope = keys && keys.length ? `project in (${keys.join(",")}) AND ` : ""
    const jql = (q: string): SourceLink => ({ href: `${base}/issues/?jql=${encodeURIComponent(scope + q)}`, label: "Open in Jira" })
    links["cycle-time"] = jql("statusCategory = Done ORDER BY resolved DESC")
    links["work-item-age"] = jql('statusCategory = "In Progress" ORDER BY created ASC')
    links["blocked-time"] = jql("statusCategory != Done ORDER BY updated DESC")
    links["defect-escape-rate"] = jql("issuetype in (Bug, Incident) ORDER BY created DESC")
    links["defect-root-cause"] = jql("issuetype in (Bug, Incident) ORDER BY created DESC")
    links["investment-allocation"] = jql("ORDER BY updated DESC")
    links["average-velocity"] = jql("sprint is not EMPTY ORDER BY updated DESC")
    links["delivery-predictability"] = jql("sprint is not EMPTY ORDER BY updated DESC")
  }

  if (gitlab?.baseUrl && gitlab.target) {
    const base = gitlab.baseUrl.replace(/\/$/, "")
    // `target` is documented as a group path (all projects); group-namespace URLs.
    const g = gitlab.target
    const gl = (path: string): SourceLink => ({ href: `${base}/groups/${g}/-/${path}`, label: "Open in GitLab" })
    links["deployment-frequency"] = gl("environments")
    links["change-failure-rate"] = gl("environments")
    links["mttr"] = gl("issues?type[]=incident")
    links["lead-time-for-changes"] = gl("merge_requests?state=merged")
    links["pr-cycle-time"] = gl("merge_requests?state=merged")
    links["test-automation-coverage"] = gl("pipelines")
  }

  return links
}
