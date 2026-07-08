import "server-only"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { metricConfig } from "@/db/schema"
import { parseConfig, type MetricConfig, type PartialMetricConfig } from "./config"

const ROW_ID = "default"

/** The effective (merged-over-defaults) metric config for compute + display. */
export async function getMetricConfig(): Promise<MetricConfig> {
  const rows = await db
    .select({ config: metricConfig.config })
    .from(metricConfig)
    .where(eq(metricConfig.id, ROW_ID))
    .limit(1)
  return parseConfig(rows[0]?.config)
}

/** The raw stored overrides (only what an admin has set) — for pre-filling the Settings form. */
export async function getRawMetricConfig(): Promise<PartialMetricConfig> {
  const rows = await db
    .select({ config: metricConfig.config })
    .from(metricConfig)
    .where(eq(metricConfig.id, ROW_ID))
    .limit(1)
  return (rows[0]?.config as PartialMetricConfig) ?? {}
}

/** Upsert the single org-level config row. `updatedById` is recorded for audit. */
export async function saveMetricConfig(config: PartialMetricConfig, updatedById?: string): Promise<void> {
  const now = new Date()
  await db
    .insert(metricConfig)
    .values({ id: ROW_ID, config, updatedById, updatedAt: now })
    .onConflictDoUpdate({ target: metricConfig.id, set: { config, updatedById, updatedAt: now } })
}
