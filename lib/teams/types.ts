// Pure team types (no DB / no React) — shared by client and server.

/** How a team maps to ingested data. */
export interface TeamConfig {
  gitlabProjects: string[] // gitlab_deployment.projectPath values
  jiraProjectKeys: string[] // jira_issue.projectKey values
}

export interface TeamRecord {
  slug: string
  name: string
  config: TeamConfig
}

/** Resolved filter passed into the compute wrappers; null = all teams (org-level). */
export interface TeamFilter {
  slug: string
  name: string
  gitlabProjectPaths: string[]
  jiraProjectKeys: string[]
}

export function normalizeTeamConfig(config: unknown): TeamConfig {
  const c = (config ?? {}) as Partial<TeamConfig>
  return {
    gitlabProjects: Array.isArray(c.gitlabProjects) ? c.gitlabProjects.filter((x): x is string => typeof x === "string") : [],
    jiraProjectKeys: Array.isArray(c.jiraProjectKeys) ? c.jiraProjectKeys.filter((x): x is string => typeof x === "string") : [],
  }
}
