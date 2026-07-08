// Pure PR (merge-request) cycle-time breakdown — no DB, unit-testable.
import type { Metric } from "./flow-compute"
import { DAY, median } from "./stats"

export interface PrMrRow {
  firstCommitAt: Date | null
  createdAt: Date | null
  firstReviewAt: Date | null
  mergedAt: Date | null
  mergeCommitSha: string | null
}

export interface PrCycleResult {
  hasData: boolean
  prCycleTime?: Metric
}

const WEEKS = 8
const HOUR = 36e5

/** Compact duration for the breakdown line (e.g. "1.2d", "3.4h", "20m"). */
function compact(ms: number): string {
  if (ms >= DAY) return `${(ms / DAY).toFixed(1)}d`
  if (ms >= HOUR) return `${(ms / HOUR).toFixed(1)}h`
  return `${Math.round(ms / 60000)}m`
}
function long(ms: number): string {
  return ms >= DAY ? `${(ms / DAY).toFixed(1)} days` : `${(ms / HOUR).toFixed(1)} hrs`
}

/** Break each merged MR's life into Coding → Pickup → Review → Deploy and report medians. */
export function computePrCycle(mrs: PrMrRow[], deployBySha: Map<string, Date>, now = new Date()): PrCycleResult {
  const since = new Date(now.getTime() - WEEKS * 7 * DAY)
  const merged = mrs.filter((m) => m.mergedAt && m.mergedAt >= since)
  if (!merged.length) return { hasData: false }

  const coding: number[] = []
  const pickup: number[] = []
  const review: number[] = []
  const deploy: number[] = []
  const total: number[] = []

  for (const m of merged) {
    if (m.firstCommitAt && m.createdAt) {
      const v = m.createdAt.getTime() - m.firstCommitAt.getTime()
      if (v >= 0) coding.push(v)
    }
    if (m.createdAt && m.firstReviewAt) {
      const v = m.firstReviewAt.getTime() - m.createdAt.getTime()
      if (v >= 0) pickup.push(v)
    }
    if (m.firstReviewAt && m.mergedAt) {
      const v = m.mergedAt.getTime() - m.firstReviewAt.getTime()
      if (v >= 0) review.push(v)
    }
    if (m.mergeCommitSha && m.mergedAt) {
      const dep = deployBySha.get(m.mergeCommitSha)
      if (dep) {
        const v = dep.getTime() - m.mergedAt.getTime()
        if (v >= 0) deploy.push(v)
      }
    }
    const start = m.firstCommitAt ?? m.createdAt
    if (start && m.mergedAt) {
      const v = m.mergedAt.getTime() - start.getTime()
      if (v >= 0) total.push(v)
    }
  }

  const medTotal = median(total)
  if (medTotal <= 0 && !coding.length && !pickup.length && !review.length) return { hasData: false }

  const stage = (label: string, arr: number[]) => (arr.length ? `${label} ${compact(median(arr))}` : null)
  const sub =
    [stage("Code", coding), stage("Pickup", pickup), stage("Review", review), stage("Deploy", deploy)]
      .filter(Boolean)
      .join(" · ") || "insufficient MR data"

  // Drill-down: median + sample size per stage. Stages come from different MR subsets
  // (Pickup/Review need a review timestamp), so they don't necessarily sum to the total.
  const stageRow = (label: string, arr: number[]) =>
    arr.length ? { label, values: [compact(median(arr)), arr.length] } : null
  const rows = [
    stageRow("Coding (commit → open)", coding),
    stageRow("Pickup (open → first review)", pickup),
    stageRow("Review (first review → merge)", review),
    stageRow("Deploy (merge → prod)", deploy),
  ].filter((r): r is { label: string; values: (string | number)[] } => r !== null)

  const note =
    review.length < total.length
      ? `Headline = first commit → merge across ${total.length} merged MRs. Pickup and Review are measured only on the ${review.length} MR(s) that carry a review timestamp, so the stages don't sum to the total.`
      : undefined

  return {
    hasData: true,
    prCycleTime: {
      value: medTotal > 0 ? long(medTotal) : "—",
      sub,
      history: [],
      trend: "flat",
      note,
      breakdown: rows.length
        ? { title: "Median time per stage", columns: ["Stage", "Median", "MRs"], rows }
        : undefined,
    },
  }
}
