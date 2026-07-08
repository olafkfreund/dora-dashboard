import "server-only"
import { computeDora } from "@/lib/metrics/dora"
import { computeJiraMetrics } from "@/lib/metrics/jira-metrics"
import { computeCoverageMetric } from "@/lib/metrics/coverage"
import { computePrCycleMetric } from "@/lib/metrics/pr-cycle"
import { getMetricConfig } from "@/lib/metrics/config-store"
import { classifyTier, type Tier } from "@/lib/metrics/dora-tier"
import { metrics as baseMetrics } from "@/lib/metrics/catalog"
import type { MetricBreakdown } from "@/lib/metrics/breakdown"
import type { TeamFilter } from "@/lib/teams/types"

type Computed = { value: string; sub: string; history: number[]; trend?: string; note?: string; breakdown?: MetricBreakdown }

export interface ReportMetric {
  id: string
  group: string
  label: string
  value: string
  sub: string
  target: string
  unit: string
  source: string
  definition: string
  formula: string
  live: boolean
  tier: Tier | null
  note?: string
  breakdown?: MetricBreakdown
}

export interface Attention {
  severity: "high" | "medium" | "info"
  metric: string
  message: string
}

export interface ReportData {
  generatedAt: Date
  windowWeeks: number
  liveCount: number
  totalCount: number
  teamName?: string
  metrics: ReportMetric[]
  attention: Attention[]
}

/** Assemble the full delivery report (same computed data the dashboard shows). Optional team filter. */
export async function buildReport(now = new Date(), filter?: TeamFilter | null): Promise<ReportData> {
  const overrides: Record<string, Computed> = {}
  const config = await getMetricConfig(filter?.slug)

  try {
    const dora = await computeDora(now, filter)
    if (dora.hasData) {
      const bd = dora.statusBreakdown
      const breakdown =
        bd && bd.length
          ? {
              title: "Deployments by status",
              columns: ["Status", `Last ${dora.windowWeeks}w`, "All time"],
              rows: bd.map((s) => ({ label: s.status, values: [s.inWindow, s.total] })),
            }
          : undefined
      if (dora.deploymentFrequency) overrides["deployment-frequency"] = { ...dora.deploymentFrequency, breakdown }
      if (dora.changeFailureRate) overrides["change-failure-rate"] = { ...dora.changeFailureRate, breakdown }
      if (dora.leadTime) overrides["lead-time-for-changes"] = { ...dora.leadTime, breakdown }
      if (dora.mttr) overrides["mttr"] = { ...dora.mttr, breakdown }
    }
  } catch {}
  try {
    const { flow, velocity, quality, allocation, feature } = await computeJiraMetrics(now, filter)
    if (feature.featureCycleTime) overrides["feature-cycle-time"] = feature.featureCycleTime
    if (flow.cycleTime) overrides["cycle-time"] = flow.cycleTime
    if (flow.workItemAge) overrides["work-item-age"] = flow.workItemAge
    if (flow.blockedTime) overrides["blocked-time"] = flow.blockedTime
    if (velocity.averageVelocity) overrides["average-velocity"] = velocity.averageVelocity
    if (velocity.deliveryPredictability) overrides["delivery-predictability"] = velocity.deliveryPredictability
    if (quality.defectEscapeRate) overrides["defect-escape-rate"] = quality.defectEscapeRate
    if (quality.defectRootCause) overrides["defect-root-cause"] = quality.defectRootCause
    if (allocation.investmentAllocation) overrides["investment-allocation"] = allocation.investmentAllocation
  } catch {}
  try {
    const coverage = await computeCoverageMetric(filter)
    if (coverage.testAutomationCoverage) overrides["test-automation-coverage"] = coverage.testAutomationCoverage
  } catch {}
  try {
    const pr = await computePrCycleMetric(now, filter)
    if (pr.prCycleTime) overrides["pr-cycle-time"] = pr.prCycleTime
  } catch {}

  const metrics: ReportMetric[] = baseMetrics.map((m) => {
    const o = overrides[m.id]
    const value = o?.value ?? m.value
    return {
      id: m.id,
      group: m.group,
      label: m.label,
      value,
      sub: o?.sub ?? m.sub,
      target: m.target,
      unit: m.unit,
      source: m.source,
      definition: m.definition,
      formula: m.formula,
      live: Boolean(o),
      tier: classifyTier(m.id, value, config.bands)?.tier ?? null,
      note: o?.note,
      breakdown: o?.breakdown,
    }
  })

  // "Needs attention" — grounded in the tiers and the data-aware notes already computed.
  const attention: Attention[] = []
  for (const m of metrics) {
    if (!m.live) continue
    if (m.tier === "Low") attention.push({ severity: "high", metric: m.label, message: `${m.label} is in the Low performance band (${m.value}). Target: ${m.target}.` })
    else if (m.tier === "Medium") attention.push({ severity: "medium", metric: m.label, message: `${m.label} is Medium (${m.value}); target ${m.target}.` })
    if (m.note) attention.push({ severity: "info", metric: m.label, message: m.note })
  }

  return {
    generatedAt: now,
    windowWeeks: config.windowWeeks,
    liveCount: metrics.filter((m) => m.live).length,
    totalCount: metrics.length,
    teamName: filter?.name,
    metrics,
    attention,
  }
}
