import "server-only"
import { inArray } from "drizzle-orm"
import { db } from "@/db"
import { gitlabCoverage } from "@/db/schema"
import { computeCoverage, type CoverageResult } from "./quality-compute"
import type { TeamFilter } from "@/lib/teams/types"

/** Test Automation Coverage from ingested GitLab CI coverage (DB-backed). Optional team filter. */
export async function computeCoverageMetric(filter?: TeamFilter | null): Promise<CoverageResult> {
  const glPaths = filter?.gitlabProjectPaths
  if (filter && (!glPaths || glPaths.length === 0)) return { hasData: false }
  const rows = await db
    .select({ coverage: gitlabCoverage.coverage, projectPath: gitlabCoverage.projectPath })
    .from(gitlabCoverage)
    .where(glPaths ? inArray(gitlabCoverage.projectPath, glPaths) : undefined)
  return computeCoverage(rows)
}
