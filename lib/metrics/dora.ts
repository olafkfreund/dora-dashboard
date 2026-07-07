import "server-only"
import { and, gte, isNotNull } from "drizzle-orm"
import { db } from "@/db"
import { gitlabDeployments } from "@/db/schema"
import { computeDoraFromRows, WEEKS, type DoraResult } from "./dora-compute"

export type { DoraMetric, DoraResult, DeploymentRow } from "./dora-compute"
export { computeDoraFromRows } from "./dora-compute"

/** Compute DORA from ingested GitLab production deployments (DB-backed). */
export async function computeDora(now = new Date()): Promise<DoraResult> {
  const since = new Date(now.getTime() - WEEKS * 7 * 864e5)
  const rows = await db
    .select({ status: gitlabDeployments.status, finishedAt: gitlabDeployments.finishedAt })
    .from(gitlabDeployments)
    .where(and(gte(gitlabDeployments.finishedAt, since), isNotNull(gitlabDeployments.finishedAt)))
  return computeDoraFromRows(rows, now)
}
