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
}

export interface DeploymentRow {
  status: string | null
  finishedAt: Date | null
}

export const WEEKS = 8
const SUCCESS = "success"
const FAILED = "failed"

function trendOf(history: number[]): "up" | "down" | "flat" {
  if (history.length < 2) return "flat"
  const last = history[history.length - 1]
  const prev = history[history.length - 2]
  if (last > prev) return "up"
  if (last < prev) return "down"
  return "flat"
}

/**
 * Deployment Frequency and Change Failure Rate over the last 8 weeks,
 * computed from production deployment rows.
 */
export function computeDoraFromRows(rows: DeploymentRow[], now = new Date()): DoraResult {
  const since = new Date(now.getTime() - WEEKS * 7 * 864e5)
  const inWindow = rows.filter((r) => r.finishedAt && r.finishedAt >= since)
  if (inWindow.length === 0) {
    return { hasData: false, deploymentsTotal: 0, windowWeeks: WEEKS }
  }

  const success = new Array(WEEKS).fill(0)
  const failed = new Array(WEEKS).fill(0)
  const weekMs = 7 * 864e5

  for (const r of inWindow) {
    if (!r.finishedAt) continue
    const idx = Math.min(WEEKS - 1, Math.floor((r.finishedAt.getTime() - since.getTime()) / weekMs))
    if (idx < 0) continue
    if (r.status === SUCCESS) success[idx]++
    else if (r.status === FAILED) failed[idx]++
  }

  const totalSuccess = success.reduce((a, b) => a + b, 0)
  const totalFailed = failed.reduce((a, b) => a + b, 0)
  const totalConsidered = totalSuccess + totalFailed

  const df: DoraMetric = {
    value: `${(totalSuccess / WEEKS).toFixed(1)}/wk`,
    sub: `${totalSuccess} prod deploys · ${WEEKS}w`,
    history: success.slice(),
    trend: trendOf(success),
  }

  const cfrHistory = success.map((s, i) => {
    const denom = s + failed[i]
    return denom ? Math.round((failed[i] / denom) * 1000) / 10 : 0
  })
  const cfr: DoraMetric = {
    value: totalConsidered ? `${Math.round((totalFailed / totalConsidered) * 1000) / 10}%` : "0%",
    sub: `${totalFailed}/${totalConsidered} deploys failed`,
    history: cfrHistory,
    trend: trendOf(cfrHistory),
  }

  return {
    hasData: true,
    deploymentsTotal: inWindow.length,
    windowWeeks: WEEKS,
    deploymentFrequency: df,
    changeFailureRate: cfr,
  }
}
