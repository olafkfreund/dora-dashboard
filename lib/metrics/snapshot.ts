import "server-only"
import { eq, isNull, asc } from "drizzle-orm"
import { db } from "@/db"
import { metricSnapshots } from "@/db/schema"
import { buildReport } from "@/lib/report/report-data"
import { resolveTeamFilter, listTeams } from "@/lib/teams/store"

const num = (v: string): number | null => {
  const n = parseFloat(v.replace(/,/g, ""))
  return Number.isFinite(n) ? n : null
}

/** Capture a numeric snapshot of every live metric, for the org and each team. */
export async function takeSnapshot(now = new Date()): Promise<{ ok: boolean; rows: number }> {
  const teams = await listTeams()
  const scopes: (string | null)[] = [null, ...teams.map((t) => t.slug)]
  const values: (typeof metricSnapshots.$inferInsert)[] = []
  for (const slug of scopes) {
    const filter = slug ? await resolveTeamFilter(slug) : null
    const report = await buildReport(now, filter)
    for (const m of report.metrics) {
      if (!m.live) continue
      const v = num(m.value)
      if (v === null) continue
      values.push({ id: `${m.id}|${slug ?? ""}|${now.getTime()}`, metricId: m.id, teamSlug: slug, value: v, capturedAt: now })
    }
  }
  if (values.length) await db.insert(metricSnapshots).values(values).onConflictDoNothing()
  return { ok: true, rows: values.length }
}

/** Chronological value series per metric for a scope (null = org), last `limit` points. */
export async function getSnapshotSeries(teamSlug?: string | null, limit = 12): Promise<Map<string, number[]>> {
  const scope = teamSlug ?? null
  const rows = await db
    .select({ metricId: metricSnapshots.metricId, value: metricSnapshots.value })
    .from(metricSnapshots)
    .where(scope === null ? isNull(metricSnapshots.teamSlug) : eq(metricSnapshots.teamSlug, scope))
    .orderBy(asc(metricSnapshots.capturedAt))
  const map = new Map<string, number[]>()
  for (const r of rows) {
    const arr = map.get(r.metricId) ?? []
    arr.push(r.value)
    map.set(r.metricId, arr)
  }
  for (const [k, arr] of map) if (arr.length > limit) map.set(k, arr.slice(-limit))
  return map
}
