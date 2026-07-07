// Pure Jira quality computation (no DB / no server-only) — unit-testable.
import type { Metric } from "./flow-compute"

export interface QualityIssueRow {
  issueType: string | null
  labels: string[] | null
}

export interface CoverageRow {
  coverage: number | null
}

export interface QualityResult {
  hasData: boolean
  defectEscapeRate?: Metric
  defectRootCause?: Metric
}

export interface CoverageResult {
  hasData: boolean
  testAutomationCoverage?: Metric
}

const isDefect = (t: string | null) => /bug|defect|incident/i.test(t ?? "")
// Post-release / escaped-to-production defects.
const ESCAPED = /post.?release|production|escaped|prod|customer|live/i
// Upstream root causes (requirements/design/analysis) — vs implementation.
const UPSTREAM = /requirement|design|analysis|spec|upstream|grooming|refinement/i

const hasLabel = (labels: string[] | null, re: RegExp) => (labels ?? []).some((l) => re.test(l))
const flat = "flat" as const

/**
 * Defect Escape Rate + Defect Root Cause from Jira defects. Uses issue labels to
 * classify (post-release vs total; upstream-caused vs total) — the customer tags
 * defects with the relevant labels (documented on the metrics page).
 */
export function computeQuality(issues: QualityIssueRow[]): QualityResult {
  const defects = issues.filter((i) => isDefect(i.issueType))
  if (!defects.length) return { hasData: false }

  const escaped = defects.filter((i) => hasLabel(i.labels, ESCAPED)).length
  const upstream = defects.filter((i) => hasLabel(i.labels, UPSTREAM)).length
  const pct = (n: number) => Math.round((n / defects.length) * 1000) / 10

  return {
    hasData: true,
    defectEscapeRate: {
      value: `${pct(escaped)}%`,
      sub: `${escaped}/${defects.length} post-release`,
      history: [],
      trend: flat,
    },
    defectRootCause: {
      value: `${pct(upstream)}%`,
      sub: `upstream-caused of ${defects.length}`,
      history: [],
      trend: flat,
    },
  }
}

/** Test Automation Coverage — mean of the latest per-project coverage (GitLab CI). */
export function computeCoverage(rows: CoverageRow[]): CoverageResult {
  const vals = rows.map((r) => r.coverage).filter((c): c is number => typeof c === "number")
  if (!vals.length) return { hasData: false }
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length
  return {
    hasData: true,
    testAutomationCoverage: {
      value: `${Math.round(avg)}%`,
      sub: `mean · ${vals.length} projects`,
      history: [],
      trend: flat,
    },
  }
}
