// Pure Jira quality computation (no DB / no server-only) — unit-testable.
import type { Metric } from "./flow-compute"

export interface QualityIssueRow {
  issueType: string | null
  labels: string[] | null
  rootCause?: string | null // Jira "Root Cause Analysis" option value
  defectEnv?: string | null // Jira "Environment Type" option value
}

// Buckets for the Root Cause Analysis field values.
const RC_TRIAGE = /under review|reject|duplicate/i // not a real cause yet
const RC_REQUIREMENTS = /requirement/i
const RC_DESIGN = /design/i
const RC_CODE = /code defect/i
const RC_CHANGE = /change request|enhancement/i
const RC_ENV = /environment|deployment|devops|access|test data/i
const rcBucket = (rc: string): string =>
  RC_TRIAGE.test(rc) ? "Under review / Rejected"
    : RC_REQUIREMENTS.test(rc) ? "Requirements"
      : RC_DESIGN.test(rc) ? "Design"
        : RC_CODE.test(rc) ? "Code"
          : RC_CHANGE.test(rc) ? "Change / Enhancement"
            : RC_ENV.test(rc) ? "Environment / Ops"
              : "Other"
// A defect's Environment Type is "escaped" when it's Production (not Pre-/Non-Prod).
const isProdEnv = (e: string) => /prod/i.test(e) && !/non.?prod|pre.?prod/i.test(e)

export interface CoverageRow {
  coverage: number | null
  projectPath?: string | null
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
// Root-cause sub-categories (for the breakdown table).
const REQUIREMENTS = /requirement|spec|grooming|refinement/i
const DESIGN = /design/i
const ANALYSIS = /analysis|upstream/i
const flat = "flat" as const

/**
 * Defect Escape Rate + Defect Root Cause from Jira defects. Prefers the dedicated
 * "Root Cause Analysis" and "Environment Type" fields when populated; otherwise
 * falls back to label-based classification.
 */
export function computeQuality(issues: QualityIssueRow[]): QualityResult {
  const defects = issues.filter((i) => isDefect(i.issueType))
  if (!defects.length) return { hasData: false }
  const pct = (n: number, dv: number) => (dv ? Math.round((n / dv) * 1000) / 10 : 0)
  const countLabel = (re: RegExp) => defects.filter((i) => hasLabel(i.labels, re)).length

  // ---- Defect Root Cause (prefer the Root Cause Analysis field) ----
  const withRc = defects.filter((i) => i.rootCause)
  let defectRootCause: Metric
  if (withRc.length >= defects.length * 0.2) {
    const counts: Record<string, number> = {}
    for (const i of withRc) {
      const b = rcBucket(i.rootCause as string)
      counts[b] = (counts[b] ?? 0) + 1
    }
    const triaged = withRc.filter((i) => !RC_TRIAGE.test(i.rootCause as string)).length
    const upstream = withRc.filter((i) => RC_REQUIREMENTS.test(i.rootCause as string) || RC_DESIGN.test(i.rootCause as string)).length
    const review = withRc.length - triaged
    const ORDER = ["Requirements", "Design", "Code", "Change / Enhancement", "Environment / Ops", "Other", "Under review / Rejected"]
    defectRootCause = {
      value: `${pct(upstream, triaged)}%`,
      sub: `upstream (requirements+design) of ${triaged} triaged`,
      history: [],
      trend: flat,
      note: review > 0 ? `${review} defect(s) are still "Under Review"/Rejected — no confirmed cause yet.` : undefined,
      breakdown: {
        title: "Defects by Root Cause Analysis",
        columns: ["Root cause", "Defects"],
        rows: ORDER.filter((k) => counts[k]).map((k) => ({ label: k, values: [counts[k]] })),
      },
    }
  } else {
    const upstream = defects.filter((i) => hasLabel(i.labels, UPSTREAM)).length
    defectRootCause = {
      value: `${pct(upstream, defects.length)}%`,
      sub: `upstream-caused of ${defects.length}`,
      history: [],
      trend: flat,
      note: upstream === 0 ? "No Root Cause Analysis field or upstream labels found — tag defects to populate." : undefined,
      breakdown: {
        title: "Defects by root-cause category",
        columns: ["Root cause", "Defects"],
        rows: [
          { label: "Requirements", values: [countLabel(REQUIREMENTS)] },
          { label: "Design", values: [countLabel(DESIGN)] },
          { label: "Analysis", values: [countLabel(ANALYSIS)] },
          { label: "Unclassified", values: [defects.length - upstream] },
        ],
      },
    }
  }

  // ---- Defect Escape Rate (prefer the Environment Type field) ----
  const withEnv = defects.filter((i) => i.defectEnv)
  let defectEscapeRate: Metric
  if (withEnv.length >= defects.length * 0.2) {
    const escaped = withEnv.filter((i) => isProdEnv(i.defectEnv as string)).length
    const envCounts: Record<string, number> = {}
    for (const i of withEnv) {
      const e = i.defectEnv as string
      envCounts[e] = (envCounts[e] ?? 0) + 1
    }
    defectEscapeRate = {
      value: `${pct(escaped, withEnv.length)}%`,
      sub: `${escaped}/${withEnv.length} found in Production`,
      history: [],
      trend: flat,
      breakdown: {
        title: "Defects by environment",
        columns: ["Environment", "Defects"],
        rows: Object.entries(envCounts).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ label: k, values: [n] })),
      },
    }
  } else {
    const escaped = defects.filter((i) => hasLabel(i.labels, ESCAPED)).length
    defectEscapeRate = {
      value: `${pct(escaped, defects.length)}%`,
      sub: `${escaped}/${defects.length} post-release`,
      history: [],
      trend: flat,
      note: escaped === 0 ? "No Environment Type field or post-release labels found — set the defect's environment to populate." : undefined,
      breakdown: {
        title: "Defects: escaped vs contained",
        columns: ["Category", "Defects"],
        rows: [
          { label: "Escaped (post-release)", values: [escaped] },
          { label: "Contained (pre-release)", values: [defects.length - escaped] },
        ],
      },
    }
  }

  return { hasData: true, defectEscapeRate, defectRootCause }
}

/** Test Automation Coverage — mean of the latest per-project coverage (GitLab CI). */
export function computeCoverage(rows: CoverageRow[]): CoverageResult {
  const vals = rows.map((r) => r.coverage).filter((c): c is number => typeof c === "number")
  if (!vals.length) return { hasData: false }
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length
  const projectRows = rows
    .filter((r): r is CoverageRow & { coverage: number } => typeof r.coverage === "number")
    .sort((a, b) => a.coverage - b.coverage) // lowest coverage first (needs attention)
    .slice(0, 15)
    .map((r) => ({ label: r.projectPath ?? "(project)", values: [`${Math.round(r.coverage)}%`] }))
  return {
    hasData: true,
    testAutomationCoverage: {
      value: `${Math.round(avg)}%`,
      sub: `mean · ${vals.length} project${vals.length === 1 ? "" : "s"}`,
      history: [],
      trend: flat,
      note:
        vals.length === 1
          ? "Coverage is from a single project's latest pipeline. Publish coverage in more pipelines for a fuller picture."
          : undefined,
      breakdown: {
        title: "Latest coverage by project (lowest first)",
        columns: ["Project", "Coverage"],
        rows: projectRows,
      },
    },
  }
}
