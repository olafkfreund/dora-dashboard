import "server-only"
import { db } from "@/db"
import { gitlabCoverage } from "@/db/schema"
import { computeCoverage, type CoverageResult } from "./quality-compute"

/** Test Automation Coverage from ingested GitLab CI coverage (DB-backed). */
export async function computeCoverageMetric(): Promise<CoverageResult> {
  const rows = await db
    .select({ coverage: gitlabCoverage.coverage, projectPath: gitlabCoverage.projectPath })
    .from(gitlabCoverage)
  return computeCoverage(rows)
}
