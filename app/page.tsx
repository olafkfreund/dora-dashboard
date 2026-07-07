import { requireUser } from "@/lib/auth-helpers"
import { AppHeader } from "@/components/app-header"
import { MetricExplorer, type MetricOverride } from "@/components/metric-explorer"
import { computeDora } from "@/lib/metrics/dora"
import { computeJiraMetrics } from "@/lib/metrics/jira-metrics"

export default async function Home() {
  const user = await requireUser()

  // Real metrics from ingested data (fall back to sample where none exists).
  const overrides: Record<string, MetricOverride> = {}
  // DORA-4 from GitLab deployments.
  try {
    const dora = await computeDora()
    if (dora.hasData) {
      if (dora.deploymentFrequency) overrides["deployment-frequency"] = dora.deploymentFrequency
      if (dora.changeFailureRate) overrides["change-failure-rate"] = dora.changeFailureRate
      if (dora.leadTime) overrides["lead-time-for-changes"] = dora.leadTime
      if (dora.mttr) overrides["mttr"] = dora.mttr
    }
  } catch {
    // ingestion not ready — keep sample DORA metrics
  }
  // Flow + Velocity from Jira.
  try {
    const { flow, velocity } = await computeJiraMetrics()
    if (flow.cycleTime) overrides["cycle-time"] = flow.cycleTime
    if (flow.workItemAge) overrides["work-item-age"] = flow.workItemAge
    if (flow.blockedTime) overrides["blocked-time"] = flow.blockedTime
    if (velocity.averageVelocity) overrides["average-velocity"] = velocity.averageVelocity
    if (velocity.deliveryPredictability) overrides["delivery-predictability"] = velocity.deliveryPredictability
  } catch {
    // Jira not connected — keep sample flow/velocity metrics
  }
  const live = Object.keys(overrides).length > 0

  return (
    <div className="min-h-screen">
      <AppHeader user={user} active="dashboard" />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-2">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-[color:var(--success)]" />
            {live
              ? "Live · DORA-4 from GitLab deployments · other metrics are sample"
              : "Preview build · sample data · connect GitLab in Settings for live DORA-4"}
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Delivery performance overview
          </h2>
        </div>

        <MetricExplorer overrides={overrides} />
      </main>
    </div>
  )
}
