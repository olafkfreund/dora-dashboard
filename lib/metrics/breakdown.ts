// Shared drill-down table shown in the metric detail modal. Pure — no React imports,
// so both the client metric types and the server-side compute functions can use it.
export interface MetricBreakdown {
  title: string
  columns: string[]
  rows: { label: string; values: (string | number)[] }[]
}

/** Deep-link from a metric to the underlying items in GitLab/Jira. */
export interface SourceLink {
  href: string
  label: string
}
