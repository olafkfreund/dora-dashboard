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
  sha?: string | null
  environment?: string | null
  ref?: string | null
}

export interface MrRow {
  mergeCommitSha: string | null
  firstCommitAt: Date | null
}

/** What counts as a (production) deployment / change failure — from metric config. */
export interface DeploymentDef {
  /** Environment allowlist; [] = match every environment. */
  environments: string[]
  /** Regex on the deployment ref/branch; null = no filter. */
  refPattern: string | null
  /** Deployment statuses that count as a change failure. */
  failureStatuses: string[]
}

export interface DoraOpts {
  /** Merged MRs, for MR-first-commit Lead Time correlation. */
  mrs?: MrRow[]
  /** "mr" = feature MR's first commit → prod (default, falls back to deployed-commit date); "gitops" = deployed-commit date only. */
  leadTimeMode?: "mr" | "gitops"
  /** Rolling window length in weeks (default WEEKS). */
  windowWeeks?: number
  /** Deployment/failure definition; defaults to match-all + status "failed". */
  deployment?: DeploymentDef
}

/** Build a RegExp, returning null on an empty or invalid pattern (never throws). */
function safeRegExp(pattern: string | null | undefined): RegExp | null {
  if (!pattern) return null
  try {
    return new RegExp(pattern)
  } catch {
    return null
  }
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

export function computeDoraFromRows(rows: DeploymentRow[], now = new Date(), opts: DoraOpts = {}): DoraResult {
  const weeks = opts.windowWeeks ?? WEEKS
  const since = new Date(now.getTime() - weeks * 7 * DAY)
  const wk = (d: Date): number =>
    Math.min(weeks - 1, Math.floor((d.getTime() - since.getTime()) / (7 * DAY)))

  // Deployment definition: environment allowlist + ref pattern + failure statuses.
  const envs = opts.deployment?.environments ?? []
  const refRe = safeRegExp(opts.deployment?.refPattern)
  const failureSet = new Set(opts.deployment?.failureStatuses ?? [FAILED])
  const matchesDef = (r: DeploymentRow): boolean =>
    (envs.length === 0 || (r.environment != null && envs.includes(r.environment))) &&
    (!refRe || (r.ref != null && refRe.test(r.ref)))
  const isFailure = (r: DeploymentRow): boolean => failureSet.has(r.status ?? "")

  const defined = rows.filter(matchesDef)
  const inWindow = defined.filter((r) => r.finishedAt && r.finishedAt >= since)
  if (inWindow.length === 0) {
    return { hasData: false, deploymentsTotal: 0, windowWeeks: weeks }
  }

  // Map deployed commit SHA → the MR's first-commit date (for MR-based lead time).
  const useMr = (opts.leadTimeMode ?? "mr") === "mr"
  const firstCommitBySha = new Map<string, Date>()
  if (useMr) {
    for (const mr of opts.mrs ?? []) {
      if (mr.mergeCommitSha && mr.firstCommitAt) firstCommitBySha.set(mr.mergeCommitSha, mr.firstCommitAt)
    }
  }

  const success = new Array(weeks).fill(0)
  const failed = new Array(weeks).fill(0)
  const leadByWeek: number[][] = Array.from({ length: weeks }, () => [])
  const mttrByWeek: number[][] = Array.from({ length: weeks }, () => [])
  const leadAll: number[] = []
  const mttrAll: number[] = []

  for (const r of inWindow) {
    if (!r.finishedAt) continue
    const idx = wk(r.finishedAt)
    if (idx < 0) continue
    if (r.status === SUCCESS) success[idx]++
    else if (isFailure(r)) failed[idx]++

    // Lead Time: prefer the feature MR's first commit (deploy sha == MR merge sha);
    // otherwise fall back to the deployed commit's own date.
    if (r.status === SUCCESS) {
      const mrStart = r.sha ? firstCommitBySha.get(r.sha) : undefined
      const startAt = mrStart ?? r.committedAt
      if (startAt) {
        const lead = r.finishedAt.getTime() - startAt.getTime()
        if (lead > 0) {
          leadByWeek[idx].push(lead)
          leadAll.push(lead)
        }
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
      if (!isFailure(arr[i])) continue
      const failTime = arr[i].finishedAt!.getTime()
      const next = arr.slice(i + 1).find((x) => x.status === SUCCESS)
      if (next) {
        const recovery = next.finishedAt!.getTime() - failTime
        if (recovery > 0) {
          mttrByWeek[wk(arr[i].finishedAt!)].push(recovery)
          mttrAll.push(recovery)
        }
      }
    }
  }

  const totalSuccess = success.reduce((a, b) => a + b, 0)
  const totalFailed = failed.reduce((a, b) => a + b, 0)
  const totalConsidered = totalSuccess + totalFailed

  const deploymentFrequency: DoraMetric = {
    value: `${(totalSuccess / weeks).toFixed(1)}/wk`,
    sub: `${totalSuccess} prod deploys · ${weeks}w`,
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
    windowWeeks: weeks,
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
