// DORA performance-tier classification from a metric's displayed value. Pure & testable.
import { DEFAULT_CONFIG, type Band, type DoraMetricId } from "./config"

export type Tier = "Elite" | "High" | "Medium" | "Low"
export type TierTone = "elite" | "high" | "medium" | "low"

export interface TierResult {
  tier: Tier
  tone: TierTone
}

const TONE: Record<Tier, TierTone> = { Elite: "elite", High: "high", Medium: "medium", Low: "low" }
const num = (v: string) => parseFloat(v.replace(/,/g, ""))

/** Convert a duration string ("2.3 hrs", "1.8 days", "40 min") to hours. */
function toHours(v: string): number {
  const n = num(v)
  if (/day/i.test(v)) return n * 24
  if (/min/i.test(v)) return n / 60
  return n // assume hours
}

/**
 * Classify a DORA-4 metric value into a performance tier, or null for non-DORA metrics.
 * Band thresholds default to the standard DORA bands; pass `bands` (from metric config)
 * to override per metric. Comparison operators are unchanged from the built-in defaults.
 */
export function classifyTier(
  metricId: string,
  value: string,
  bands?: Partial<Record<DoraMetricId, Band>>
): TierResult | null {
  const n = num(value)
  if (Number.isNaN(n)) return null
  const band = (id: DoraMetricId): Band => bands?.[id] ?? DEFAULT_CONFIG.bands[id]
  let tier: Tier | null = null

  switch (metricId) {
    case "deployment-frequency": {
      // deploys/week (higher is better): Elite ≈ daily+, High ≈ weekly+, Medium ≈ monthly+.
      const { elite, high, medium } = band("deployment-frequency")
      tier = n >= elite ? "Elite" : n >= high ? "High" : n >= medium ? "Medium" : "Low"
      break
    }
    case "lead-time-for-changes": {
      const days = toHours(value) / 24
      const { elite, high, medium } = band("lead-time-for-changes")
      tier = days < elite ? "Elite" : days <= high ? "High" : days <= medium ? "Medium" : "Low"
      break
    }
    case "change-failure-rate": {
      const { elite, high, medium } = band("change-failure-rate")
      tier = n <= elite ? "Elite" : n <= high ? "High" : n <= medium ? "Medium" : "Low"
      break
    }
    case "mttr": {
      const hours = toHours(value)
      const { elite, high, medium } = band("mttr")
      tier = hours < elite ? "Elite" : hours < high ? "High" : hours <= medium ? "Medium" : "Low"
      break
    }
    default:
      return null
  }
  return { tier, tone: TONE[tier] }
}
