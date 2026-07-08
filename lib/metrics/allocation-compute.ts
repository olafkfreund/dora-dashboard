// Pure investment/allocation computation (no DB) — unit-testable.
import type { Metric } from "./flow-compute"

export interface AllocIssueRow {
  issueType: string | null
  labels: string[] | null
  storyPoints: number | null
}

export interface AllocResult {
  hasData: boolean
  investmentAllocation?: Metric
}

export type AllocCategory = "feature" | "ktlo" | "debt" | "support"

const DEBT = /tech.?debt|\bdebt\b|refactor/i
const SUPPORT = /support|incident|hotfix/i
const KTLO = /ktlo|maintenance|keep.the.lights|chore|\bops\b|\binfra\b/i

/** Assign an issue to one investment category by type + labels (debt > support > ktlo > feature). */
export function categorize(i: AllocIssueRow): AllocCategory {
  const labels = i.labels ?? []
  const hasLabel = (re: RegExp) => labels.some((l) => re.test(l))
  const type = i.issueType ?? ""
  if (hasLabel(DEBT)) return "debt"
  if (SUPPORT.test(type) || hasLabel(SUPPORT)) return "support"
  if (hasLabel(KTLO)) return "ktlo"
  return "feature" // Story/Task/Feature and anything else = delivery work
}

export function computeAllocation(issues: AllocIssueRow[]): AllocResult {
  if (!issues.length) return { hasData: false }
  const w: Record<AllocCategory, number> = { feature: 0, ktlo: 0, debt: 0, support: 0 }
  let pointed = 0
  for (const i of issues) {
    if ((i.storyPoints ?? 0) > 0) pointed++
    const pts = i.storyPoints && i.storyPoints > 0 ? i.storyPoints : 1
    w[categorize(i)] += pts
  }
  const total = w.feature + w.ktlo + w.debt + w.support
  if (total <= 0) return { hasData: false }
  const pct = (n: number) => Math.round((n / total) * 100)
  // If few issues are story-pointed, allocation is effectively issue-count based — say so.
  const note =
    pointed / issues.length < 0.2
      ? `Only ${pointed} of ${issues.length} issues have story points, so this split is weighted mostly by issue count (each unpointed issue counts as 1). Add story-point estimates for an effort-weighted view. Categories come from issue type + labels (tech-debt/refactor, support/incident/hotfix, ktlo/maintenance) — everything else counts as feature work.`
      : `Categories come from issue type + labels (tech-debt/refactor → debt, support/incident/hotfix → support, ktlo/maintenance → KTLO); everything else is feature work.`
  return {
    hasData: true,
    investmentAllocation: {
      value: `${pct(w.feature)}% feature`,
      sub: `KTLO ${pct(w.ktlo)}% · Debt ${pct(w.debt)}% · Support ${pct(w.support)}%`,
      history: [],
      trend: "flat",
      note,
    },
  }
}
