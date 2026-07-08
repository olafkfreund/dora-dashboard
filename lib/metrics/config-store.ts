import "server-only"
import { eq, inArray } from "drizzle-orm"
import { db } from "@/db"
import { metricConfig } from "@/db/schema"
import { parseConfig, type MetricConfig, type PartialMetricConfig } from "./config"

const ORG_ID = "default"
const teamId = (slug: string) => `team:${slug}`

/** Shallow-merge two partial configs (b overrides a) before parsing/defaulting. */
function mergePartials(a: PartialMetricConfig, b: PartialMetricConfig): PartialMetricConfig {
  return {
    deployment: { ...(a.deployment ?? {}), ...(b.deployment ?? {}) },
    windowWeeks: b.windowWeeks ?? a.windowWeeks,
    mttrMode: b.mttrMode ?? a.mttrMode,
    bands: { ...(a.bands ?? {}), ...(b.bands ?? {}) },
    targets: { ...(a.targets ?? {}), ...(b.targets ?? {}) },
  }
}

/**
 * The effective (merged-over-defaults) metric config. With a team slug, the team's
 * overrides layer over the org config, which layers over the built-in defaults.
 */
export async function getMetricConfig(teamSlug?: string | null): Promise<MetricConfig> {
  const ids = teamSlug ? [ORG_ID, teamId(teamSlug)] : [ORG_ID]
  const rows = await db.select({ id: metricConfig.id, config: metricConfig.config }).from(metricConfig).where(inArray(metricConfig.id, ids))
  const org = (rows.find((r) => r.id === ORG_ID)?.config ?? {}) as PartialMetricConfig
  const team = teamSlug ? (rows.find((r) => r.id === teamId(teamSlug))?.config as PartialMetricConfig | undefined) : undefined
  return parseConfig(team ? mergePartials(org, team) : org)
}

/** The raw stored overrides for org (or a team) — for pre-filling the Settings form. */
export async function getRawMetricConfig(teamSlug?: string | null): Promise<PartialMetricConfig> {
  const id = teamSlug ? teamId(teamSlug) : ORG_ID
  const rows = await db.select({ config: metricConfig.config }).from(metricConfig).where(eq(metricConfig.id, id)).limit(1)
  return (rows[0]?.config as PartialMetricConfig) ?? {}
}

/** Upsert the org (or a team's) config row. `updatedById` is recorded for audit. */
export async function saveMetricConfig(config: PartialMetricConfig, updatedById?: string, teamSlug?: string | null): Promise<void> {
  const id = teamSlug ? teamId(teamSlug) : ORG_ID
  const now = new Date()
  await db
    .insert(metricConfig)
    .values({ id, config, updatedById, updatedAt: now })
    .onConflictDoUpdate({ target: metricConfig.id, set: { config, updatedById, updatedAt: now } })
}
