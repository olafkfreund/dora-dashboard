// Pure metric-configuration layer (no DB / no server-only) — unit-testable.
// Defines what counts as a deployment/failure, the rolling window, per-DORA-metric
// benchmark bands, and per-metric targets. An empty/missing config reproduces the
// dashboard's original hardcoded behaviour exactly (see DEFAULT_CONFIG).
import { z } from "zod"

export const DORA_METRIC_IDS = [
  "deployment-frequency",
  "lead-time-for-changes",
  "change-failure-rate",
  "mttr",
] as const

export type DoraMetricId = (typeof DORA_METRIC_IDS)[number]

const bandSchema = z.object({
  elite: z.number(),
  high: z.number(),
  medium: z.number(),
})
export type Band = z.infer<typeof bandSchema>

// Static KPI baseline + phased improvement targets. Free-text so values like
// "<150 Days" / "70%" render verbatim (they're programme goalposts, not computed).
const baselineSchema = z.object({
  baseline: z.string(),
  week9: z.string(),
  week12: z.string(),
  note: z.string(),
})
export type MetricBaseline = z.infer<typeof baselineSchema>

// Metric ids shown in the "KPI Baseline & Targets" panel, in display order.
export const BASELINE_METRIC_IDS = [
  "lead-time-for-changes",
  "cycle-time",
  "delivery-predictability",
  "work-item-age",
] as const

export const metricConfigSchema = z.object({
  deployment: z.object({
    // Environment allowlist; [] = match every environment (no filter).
    environments: z.array(z.string()),
    // Optional regex on the deployment ref/branch; null = no filter.
    refPattern: z.string().nullable(),
    // Which deployment statuses count as a change failure (CFR).
    failureStatuses: z.array(z.string()),
  }),
  windowWeeks: z.number().int().positive().max(52),
  // Absolute start floor for ALL metrics (ISO date). When set, every metric is
  // measured from this date forward, overriding the rolling windowWeeks — used to
  // start the picture at a chosen sprint (e.g. "Sprint 35" → its startDate) so
  // pre-baseline history no longer skews the numbers. null = rolling window only.
  measureFrom: z.string().nullable(),
  // MTTR source: "proxy" = failed→next-success deploy recovery; "incident" = GitLab incidents (close−open).
  mttrMode: z.enum(["proxy", "incident"]),
  bands: z.object({
    "deployment-frequency": bandSchema,
    "lead-time-for-changes": bandSchema,
    "change-failure-rate": bandSchema,
    mttr: bandSchema,
  }),
  // Per-metric target values (units per metric); merged over the built-in targets.
  targets: z.record(z.string(), z.number()),
  // Static KPI baseline + 9-week / 12-week improvement targets (per metric id),
  // shown in the "KPI Baseline & Targets" panel.
  baselines: z.record(z.string(), baselineSchema),
  // Metric ids hidden from the dashboard (admin-controlled card visibility).
  hiddenMetrics: z.array(z.string()),
  // Exact Jira status names that count as "blocked" for Blocked Time. Empty = auto-detect
  // by name (block/on hold/impediment) using the value stored at ingest.
  blockedStatuses: z.array(z.string()),
  // Jira status names excluded from Work Item Age (parked/abandoned work, e.g. Deferred,
  // Future releases, TO BE DELETED). Age already counts only In-Progress-category items.
  ageExcludedStatuses: z.array(z.string()),
})

export type MetricConfig = z.infer<typeof metricConfigSchema>

// Safe defaults: match-all deployment filter + the original hardcoded DORA bands.
// Changing `environments` to a non-empty allowlist is an explicit admin action.
export const DEFAULT_CONFIG: MetricConfig = {
  deployment: {
    environments: [],
    refPattern: null,
    failureStatuses: ["failed"],
  },
  windowWeeks: 8,
  measureFrom: null,
  mttrMode: "proxy",
  bands: {
    "deployment-frequency": { elite: 7, high: 1, medium: 0.25 },
    "lead-time-for-changes": { elite: 1, high: 7, medium: 30 }, // days
    "change-failure-rate": { elite: 15, high: 30, medium: 45 }, // %
    mttr: { elite: 1, high: 24, medium: 168 }, // hours
  },
  targets: {},
  baselines: {
    "lead-time-for-changes": {
      baseline: "220 Days",
      week9: "220 Days",
      week12: "<150 Days",
      note: "The amount of time from when an idea is proposed, or a hypothesis is formed, until a customer can benefit from that idea.",
    },
    "cycle-time": {
      baseline: "60 Days",
      week9: "<40 Days",
      week12: "<15 Days",
      note: "The amount of time from when work starts on a release until the point where it is released.",
    },
    "delivery-predictability": {
      baseline: "50%",
      week9: "70%",
      week12: "80%",
      note: "Measures how consistently the team delivers the work it commits to within the planned timeframe.",
    },
    "work-item-age": {
      baseline: "140 Days",
      week9: "<45 Days",
      week12: "< 30 Days",
      note: "How long a work item has been in progress and not yet completed.",
    },
  },
  hiddenMetrics: [],
  blockedStatuses: [],
  ageExcludedStatuses: [],
}

// A partial config as stored in the DB (any subset of keys, any depth).
export type PartialMetricConfig = {
  deployment?: Partial<MetricConfig["deployment"]>
  windowWeeks?: number
  measureFrom?: string | null
  mttrMode?: "proxy" | "incident"
  bands?: Partial<Record<DoraMetricId, Partial<Band>>>
  targets?: Record<string, number>
  baselines?: Record<string, MetricBaseline>
  hiddenMetrics?: string[]
  blockedStatuses?: string[]
  ageExcludedStatuses?: string[]
}

/** Depth-aware merge of a partial config over DEFAULT_CONFIG (missing keys fall back). */
export function mergeConfig(p: PartialMetricConfig): MetricConfig {
  const bands = {} as MetricConfig["bands"]
  for (const id of DORA_METRIC_IDS) {
    bands[id] = { ...DEFAULT_CONFIG.bands[id], ...(p.bands?.[id] ?? {}) }
  }
  return {
    deployment: { ...DEFAULT_CONFIG.deployment, ...(p.deployment ?? {}) },
    windowWeeks: p.windowWeeks ?? DEFAULT_CONFIG.windowWeeks,
    measureFrom: p.measureFrom ?? DEFAULT_CONFIG.measureFrom,
    mttrMode: p.mttrMode ?? DEFAULT_CONFIG.mttrMode,
    bands,
    targets: { ...DEFAULT_CONFIG.targets, ...(p.targets ?? {}) },
    baselines: { ...DEFAULT_CONFIG.baselines, ...(p.baselines ?? {}) },
    hiddenMetrics: p.hiddenMetrics ?? DEFAULT_CONFIG.hiddenMetrics,
    blockedStatuses: p.blockedStatuses ?? DEFAULT_CONFIG.blockedStatuses,
    ageExcludedStatuses: p.ageExcludedStatuses ?? DEFAULT_CONFIG.ageExcludedStatuses,
  }
}

/** Merge + validate a raw stored config; fall back to DEFAULT_CONFIG on anything invalid. */
export function parseConfig(raw: unknown): MetricConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_CONFIG
  const merged = mergeConfig(raw as PartialMetricConfig)
  const res = metricConfigSchema.safeParse(merged)
  return res.success ? res.data : DEFAULT_CONFIG
}

/**
 * Effective observation-window length in weeks. With no `measureFrom`, the rolling
 * `defaultWeeks` is used unchanged. When `measureFrom` is set it OVERRIDES the rolling
 * window: the window spans measureFrom→now (rounded up to whole weeks, min 1), so all
 * metrics start at that date — wider than the default when the floor is old, narrower
 * when it is recent. Keeping a single week-count keeps the existing `since`/bucketing
 * math intact everywhere it is threaded.
 */
export function effectiveWeeks(defaultWeeks: number, measureFrom: Date | null, now: Date): number {
  if (!measureFrom) return defaultWeeks
  const weeks = Math.ceil((now.getTime() - measureFrom.getTime()) / (7 * 864e5))
  return Math.max(1, weeks)
}
