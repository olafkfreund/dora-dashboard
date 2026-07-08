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
  // Metric ids hidden from the dashboard (admin-controlled card visibility).
  hiddenMetrics: z.array(z.string()),
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
  mttrMode: "proxy",
  bands: {
    "deployment-frequency": { elite: 7, high: 1, medium: 0.25 },
    "lead-time-for-changes": { elite: 1, high: 7, medium: 30 }, // days
    "change-failure-rate": { elite: 15, high: 30, medium: 45 }, // %
    mttr: { elite: 1, high: 24, medium: 168 }, // hours
  },
  targets: {},
  hiddenMetrics: [],
}

// A partial config as stored in the DB (any subset of keys, any depth).
export type PartialMetricConfig = {
  deployment?: Partial<MetricConfig["deployment"]>
  windowWeeks?: number
  mttrMode?: "proxy" | "incident"
  bands?: Partial<Record<DoraMetricId, Partial<Band>>>
  targets?: Record<string, number>
  hiddenMetrics?: string[]
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
    mttrMode: p.mttrMode ?? DEFAULT_CONFIG.mttrMode,
    bands,
    targets: { ...DEFAULT_CONFIG.targets, ...(p.targets ?? {}) },
    hiddenMetrics: p.hiddenMetrics ?? DEFAULT_CONFIG.hiddenMetrics,
  }
}

/** Merge + validate a raw stored config; fall back to DEFAULT_CONFIG on anything invalid. */
export function parseConfig(raw: unknown): MetricConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_CONFIG
  const merged = mergeConfig(raw as PartialMetricConfig)
  const res = metricConfigSchema.safeParse(merged)
  return res.success ? res.data : DEFAULT_CONFIG
}
