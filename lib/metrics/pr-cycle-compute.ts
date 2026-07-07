// Pure PR (merge-request) cycle-time breakdown — no DB, unit-testable.
import type { Metric } from "./flow-compute"

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
const DAY = 864e5
const HOUR = 36e5

function median(nums: number[]): number {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

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

  return {
    hasData: true,
    prCycleTime: {
      value: medTotal > 0 ? long(medTotal) : "—",
      sub,
      history: [],
      trend: "flat",
    },
  }
}
