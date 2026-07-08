// Pure Jira flow + velocity computation (no DB / no server-only) — unit-testable.

export interface Metric {
  value: string
  sub: string
  history: number[]
  trend: "up" | "down" | "flat"
  /** Optional data-aware explanation shown in the detail modal (esp. for 0/thin values). */
  note?: string
}

export interface FlowIssueRow {
  statusCategory: string | null
  storyPoints: number | null
  sprintId: number | null
  createdAt: Date | null
  inProgressAt: Date | null
  resolvedAt: Date | null
  blockedSeconds: number | null
}

export interface SprintRow {
  id: number
  state: string | null
  startDate: Date | null
  completeDate: Date | null
}

export interface FlowResult {
  hasData: boolean
  cycleTime?: Metric
  workItemAge?: Metric
  blockedTime?: Metric
}

export interface VelocityResult {
  hasData: boolean
  averageVelocity?: Metric
  deliveryPredictability?: Metric
}

const WEEKS = 8
const DAY = 864e5
const isDone = (c: string | null) => c === "Done"

function median(nums: number[]): number {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
const mean = (n: number[]) => (n.length ? n.reduce((a, b) => a + b, 0) / n.length : 0)

function trendOf(history: number[]): "up" | "down" | "flat" {
  const nz = history.filter((h) => h > 0)
  if (nz.length < 2) return "flat"
  const [prev, last] = [nz[nz.length - 2], nz[nz.length - 1]]
  return last > prev ? "up" : last < prev ? "down" : "flat"
}

const fmtDays = (d: number) => `${d.toFixed(1)} days`

/** Cycle Time, Work Item Age, Blocked Time from Jira issues. */
export function computeFlow(issues: FlowIssueRow[], now = new Date()): FlowResult {
  if (!issues.length) return { hasData: false }
  const since = new Date(now.getTime() - WEEKS * 7 * DAY)
  const weekIdx = (d: Date) => Math.min(WEEKS - 1, Math.max(0, Math.floor((d.getTime() - since.getTime()) / (7 * DAY))))

  // Cycle Time — completed items in window: resolved − started.
  const cycleAll: number[] = []
  const cycleByWeek: number[][] = Array.from({ length: WEEKS }, () => [])
  for (const i of issues) {
    if (isDone(i.statusCategory) && i.resolvedAt && i.inProgressAt && i.resolvedAt >= since) {
      const days = (i.resolvedAt.getTime() - i.inProgressAt.getTime()) / DAY
      if (days >= 0) {
        cycleAll.push(days)
        cycleByWeek[weekIdx(i.resolvedAt)].push(days)
      }
    }
  }

  // Work Item Age — still-open, in-progress items: now − started (snapshot).
  const ages: number[] = []
  for (const i of issues) {
    if (!isDone(i.statusCategory) && i.inProgressAt) {
      ages.push((now.getTime() - i.inProgressAt.getTime()) / DAY)
    }
  }

  // Blocked Time — share of item lifetime spent blocked.
  let blockedSecs = 0
  let lifetimeSecs = 0
  for (const i of issues) {
    if (!i.createdAt) continue
    const end = i.resolvedAt ?? now
    lifetimeSecs += Math.max(0, (end.getTime() - i.createdAt.getTime()) / 1000)
    blockedSecs += i.blockedSeconds ?? 0
  }

  const result: FlowResult = { hasData: true }
  if (cycleAll.length) {
    const hist = cycleByWeek.map((w) => Math.round(median(w) * 10) / 10)
    result.cycleTime = { value: fmtDays(median(cycleAll)), sub: `median · ${cycleAll.length} items`, history: hist, trend: trendOf(hist) }
  }
  if (ages.length) {
    result.workItemAge = { value: fmtDays(mean(ages)), sub: `mean · ${ages.length} open`, history: [], trend: "flat" }
  }
  if (lifetimeSecs > 0) {
    const pct = Math.round((blockedSecs / lifetimeSecs) * 1000) / 10
    result.blockedTime = { value: `${pct}%`, sub: `of item lifetime`, history: [], trend: "flat" }
  }
  return result
}

/** Average Velocity + Delivery Predictability from closed sprints. */
export function computeVelocity(sprints: SprintRow[], issues: FlowIssueRow[], windowSize = 5): VelocityResult {
  const closed = sprints
    .filter((s) => s.state === "closed" && s.completeDate)
    .sort((a, b) => a.completeDate!.getTime() - b.completeDate!.getTime())
    .slice(-windowSize)
  if (!closed.length) return { hasData: false }

  const completedPerSprint: number[] = []
  const predictabilityPerSprint: number[] = []
  let pointedInClosed = 0
  for (const sprint of closed) {
    const inSprint = issues.filter((i) => i.sprintId === sprint.id)
    pointedInClosed += inSprint.filter((i) => (i.storyPoints ?? 0) > 0).length
    const committed = inSprint.reduce((a, i) => a + (i.storyPoints ?? 0), 0)
    const completed = inSprint.filter((i) => isDone(i.statusCategory)).reduce((a, i) => a + (i.storyPoints ?? 0), 0)
    completedPerSprint.push(completed)
    if (committed > 0) predictabilityPerSprint.push(Math.round((completed / committed) * 1000) / 10)
  }

  const result: VelocityResult = { hasData: true }
  const avg = mean(completedPerSprint)
  // Explain a 0 (the common "sprints exist but issues aren't story-pointed" case).
  const velNote =
    avg > 0
      ? undefined
      : pointedInClosed === 0
        ? `The last ${closed.length} closed sprint(s) contain no story-pointed issues, so completed velocity is 0. Add story-point estimates to Jira issues for this to reflect real throughput.`
        : `Issues in the last ${closed.length} closed sprint(s) carry story points but none are marked Done, so completed velocity is 0.`
  result.averageVelocity = {
    value: `${Math.round(avg)} pts`,
    sub: `avg · last ${closed.length} sprint${closed.length === 1 ? "" : "s"}`,
    history: completedPerSprint.map((v) => Math.round(v)),
    trend: trendOf(completedPerSprint),
    note: velNote,
  }
  if (predictabilityPerSprint.length) {
    result.deliveryPredictability = {
      value: `${Math.round(mean(predictabilityPerSprint))}%`,
      sub: `committed vs completed`,
      history: predictabilityPerSprint,
      trend: trendOf(predictabilityPerSprint),
    }
  } else {
    result.deliveryPredictability = {
      value: "—",
      sub: "no committed points",
      history: [],
      trend: "flat",
      note: `The last ${closed.length} closed sprint(s) have no committed story points, so predictability can't be computed. It needs sprint issues with story-point estimates.`,
    }
  }
  return result
}
