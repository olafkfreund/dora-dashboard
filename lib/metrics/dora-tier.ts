// DORA performance-tier classification from a metric's displayed value. Pure & testable.

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

/** Classify a DORA-4 metric value into a performance tier, or null for non-DORA metrics. */
export function classifyTier(metricId: string, value: string): TierResult | null {
  const n = num(value)
  if (Number.isNaN(n)) return null
  let tier: Tier | null = null

  switch (metricId) {
    case "deployment-frequency": {
      // deploys/week (higher is better): Elite ≈ daily+, High ≈ weekly+, Medium ≈ monthly+.
      tier = n >= 7 ? "Elite" : n >= 1 ? "High" : n >= 0.25 ? "Medium" : "Low"
      break
    }
    case "lead-time-for-changes": {
      const days = toHours(value) / 24
      tier = days < 1 ? "Elite" : days <= 7 ? "High" : days <= 30 ? "Medium" : "Low"
      break
    }
    case "change-failure-rate": {
      tier = n <= 15 ? "Elite" : n <= 30 ? "High" : n <= 45 ? "Medium" : "Low"
      break
    }
    case "mttr": {
      const hours = toHours(value)
      tier = hours < 1 ? "Elite" : hours < 24 ? "High" : hours <= 168 ? "Medium" : "Low"
      break
    }
    default:
      return null
  }
  return { tier, tone: TONE[tier] }
}
