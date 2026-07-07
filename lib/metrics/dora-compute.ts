// Pure DORA computation (no DB / no server-only) — unit-testable.

export interface DoraMetric {
  value: string
  sub: string
  history: number[]
  trend: "up" | "down" | "flat"
}

export interface DoraResult {
  hasData: boolean
  deploymentsTotal: number
  windowWeeks: number
  deploymentFrequency?: DoraMetric
  changeFailureRate?: DoraMetric
  leadTime?: DoraMetric
  mttr?: DoraMetric
}

export interface DeploymentRow {
  projectId: number
  status: string | null
  finishedAt: Date | null
  committedAt?: Date | null
}

export const WEEKS = 8
const SUCCESS = "success"
const FAILED = "failed"
const DAY = 864e5
const HOUR = 36e5

function trendOf(history: number[]): "up" | "down" | "flat" {
  const nz = history.filter((h) => h > 0)
  if (nz.length < 2) return "flat"
  const last = nz[nz.length - 1]
  const prev = nz[nz.length - 2]
  if (last > prev) return "up"
  if (last < prev) return "down"
  return "flat"
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function fmtDuration(ms: number): string {
  if (ms <= 0) return "—"
  const days = ms / DAY
  if (days >= 1) return `${days.toFixed(1)} days`
  return `${(ms / HOUR).toFixed(1)} hrs`
}

function weekIndex(d: Date, since: Date): number {
  return Math.min(WEEKS - 1, Math.floor((d.getTime() - since.getTime()) / (7 * DAY)))
}

export function computeDoraFromRows(rows: DeploymentRow[], now = new Date()): DoraResult {
  const since = new Date(now.getTime() - WEEKS * 7 * DAY)
  const inWindow = rows.filter((r) => r.finishedAt && r.finishedAt >= since)
  if (inWindow.length === 0) {
    return { hasData: false, deploymentsTotal: 0, windowWeeks: WEEKS }
  }

  const success = new Array(WEEKS).fill(0)
  const failed = new Array(WEEKS).fill(0)
  const leadByWeek: number[][] = Array.from({ length: WEEKS }, () => [])
  const mttrByWeek: number[][] = Array.from({ length: WEEKS }, () => [])
  const leadAll: number[] = []
  const mttrAll: number[] = []

  for (const r of inWindow) {
    if (!r.finishedAt) continue
    const idx = weekIndex(r.finishedAt, since)
    if (idx < 0) continue
    if (r.status === SUCCESS) success[idx]++
    else if (r.status === FAILED) failed[idx]++

    // Lead Time: successful deploy's finish − deployed commit's date.
    if (r.status === SUCCESS && r.committedAt) {
      const lead = r.finishedAt.getTime() - r.committedAt.getTime()
      if (lead > 0) {
        leadByWeek[idx].push(lead)
        leadAll.push(lead)
      }
    }
  }

  // MTTR (deployment-recovery proxy): per project, each failed deploy → next success.
  const byProject = new Map<number, DeploymentRow[]>()
  for (const r of inWindow) {
    if (!r.finishedAt) continue
    const arr = byProject.get(r.projectId) ?? []
    arr.push(r)
    byProject.set(r.projectId, arr)
  }
  for (const arr of byProject.values()) {
    arr.sort((a, b) => a.finishedAt!.getTime() - b.finishedAt!.getTime())
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].status !== FAILED) continue
      const failTime = arr[i].finishedAt!.getTime()
      const next = arr.slice(i + 1).find((x) => x.status === SUCCESS)
      if (next) {
        const recovery = next.finishedAt!.getTime() - failTime
        if (recovery > 0) {
          mttrByWeek[weekIndex(arr[i].finishedAt!, since)].push(recovery)
          mttrAll.push(recovery)
        }
      }
    }
  }

  const totalSuccess = success.reduce((a, b) => a + b, 0)
  const totalFailed = failed.reduce((a, b) => a + b, 0)
  const totalConsidered = totalSuccess + totalFailed

  const deploymentFrequency: DoraMetric = {
    value: `${(totalSuccess / WEEKS).toFixed(1)}/wk`,
    sub: `${totalSuccess} prod deploys · ${WEEKS}w`,
    history: success.slice(),
    trend: trendOf(success),
  }

  const cfrHistory = success.map((s, i) => {
    const denom = s + failed[i]
    return denom ? Math.round((failed[i] / denom) * 1000) / 10 : 0
  })
  const changeFailureRate: DoraMetric = {
    value: totalConsidered ? `${Math.round((totalFailed / totalConsidered) * 1000) / 10}%` : "0%",
    sub: `${totalFailed}/${totalConsidered} deploys failed`,
    history: cfrHistory,
    trend: trendOf(cfrHistory),
  }

  const result: DoraResult = {
    hasData: true,
    deploymentsTotal: inWindow.length,
    windowWeeks: WEEKS,
    deploymentFrequency,
    changeFailureRate,
  }

  if (leadAll.length) {
    const leadHist = leadByWeek.map((w) => Math.round((median(w) / DAY) * 10) / 10)
    result.leadTime = {
      value: fmtDuration(median(leadAll)),
      sub: `median · ${leadAll.length} changes`,
      history: leadHist,
      trend: trendOf(leadHist),
    }
  }
  if (mttrAll.length) {
    const mttrHist = mttrByWeek.map((w) => Math.round((median(w) / HOUR) * 10) / 10)
    result.mttr = {
      value: fmtDuration(median(mttrAll)),
      sub: `median · ${mttrAll.length} recoveries`,
      history: mttrHist,
      trend: trendOf(mttrHist),
    }
  }
  return result
}
