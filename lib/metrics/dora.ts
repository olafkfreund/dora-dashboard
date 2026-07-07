import "server-only"
import { and, gte, isNotNull } from "drizzle-orm"
import { db } from "@/db"
import { gitlabDeployments } from "@/db/schema"

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

const WEEKS = 8
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
 * Compute Deployment Frequency and Change Failure Rate from ingested GitLab
 * production deployments over the last 8 weeks. Returns hasData=false if none.
 */
export async function computeDora(now = new Date()): Promise<DoraResult> {
  const since = new Date(now.getTime() - WEEKS * 7 * 864e5)
  const rows = await db
    .select({
      status: gitlabDeployments.status,
      finishedAt: gitlabDeployments.finishedAt,
    })
    .from(gitlabDeployments)
    .where(
      and(
        gte(gitlabDeployments.finishedAt, since),
        isNotNull(gitlabDeployments.finishedAt)
      )
    )

  if (rows.length === 0) {
    return { hasData: false, deploymentsTotal: 0, windowWeeks: WEEKS }
  }

  // Weekly buckets: index 0 = oldest week, WEEKS-1 = current week.
  const success = new Array(WEEKS).fill(0)
  const failed = new Array(WEEKS).fill(0)
  const weekMs = 7 * 864e5

  for (const r of rows) {
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
    // For CFR, a downward trend is good — trend here is raw direction.
    trend: trendOf(cfrHistory),
  }

  return {
    hasData: true,
    deploymentsTotal: rows.length,
    windowWeeks: WEEKS,
    deploymentFrequency: df,
    changeFailureRate: cfr,
  }
}
