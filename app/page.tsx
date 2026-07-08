import { FileDown, Sheet } from "lucide-react"
import { requireUser } from "@/lib/auth-helpers"
import { AppHeader } from "@/components/app-header"
import { MetricExplorer, type MetricOverride } from "@/components/metric-explorer"
import { computeDora } from "@/lib/metrics/dora"
import { computeJiraMetrics } from "@/lib/metrics/jira-metrics"
import { computeCoverageMetric } from "@/lib/metrics/coverage"
import { computePrCycleMetric } from "@/lib/metrics/pr-cycle"
import { getMetricConfig } from "@/lib/metrics/config-store"

export default async function Home() {
  const user = await requireUser()

  // Real metrics from ingested data (fall back to sample where none exists).
  const overrides: Record<string, MetricOverride> = {}
  // DORA-4 from GitLab deployments.
  try {
    const dora = await computeDora()
    if (dora.hasData) {
      // Shared deployment-status breakdown (window vs all-time) for the detail modal.
      const bd = dora.statusBreakdown
      const breakdown =
        bd && bd.length
          ? {
              title: "Deployments by status",
              columns: ["Status", `Last ${dora.windowWeeks}w`, "All time"],
              rows: bd.map((s) => ({ label: s.status, values: [s.inWindow, s.total] })),
            }
          : undefined
      if (dora.deploymentFrequency) overrides["deployment-frequency"] = { ...dora.deploymentFrequency, breakdown }
      if (dora.changeFailureRate) {
        const failed = bd?.find((s) => s.status === "failed")
        const older = failed ? failed.total - failed.inWindow : 0
        const cfrNote = failed
          ? `${failed.inWindow} failed deployment(s) in the last ${dora.windowWeeks}w of ${dora.deploymentsTotal} total.` +
            (older > 0 ? ` ${older} more failed deployment(s) are older than the window.` : "") +
            ` Note: a GitLab "failed" deployment means the deploy job itself errored — not necessarily a production incident, so this can under-count real change failures.`
          : `No deployments had a failure status in the last ${dora.windowWeeks}w, so the rate is 0%. Note: a GitLab "failed" deployment = the deploy job errored, not a production incident — real change failures may not appear here.`
        overrides["change-failure-rate"] = { ...dora.changeFailureRate, breakdown, note: cfrNote }
      }
      if (dora.leadTime) overrides["lead-time-for-changes"] = { ...dora.leadTime, breakdown }
      if (dora.mttr) overrides["mttr"] = { ...dora.mttr, breakdown }
    }
  } catch {
    // ingestion not ready — keep sample DORA metrics
  }
  // Flow + Velocity + Quality from Jira.
  try {
    const { flow, velocity, quality, allocation } = await computeJiraMetrics()
    if (flow.cycleTime) overrides["cycle-time"] = flow.cycleTime
    if (flow.workItemAge) overrides["work-item-age"] = flow.workItemAge
    if (flow.blockedTime) overrides["blocked-time"] = flow.blockedTime
    if (velocity.averageVelocity) overrides["average-velocity"] = velocity.averageVelocity
    if (velocity.deliveryPredictability) overrides["delivery-predictability"] = velocity.deliveryPredictability
    if (quality.defectEscapeRate) overrides["defect-escape-rate"] = quality.defectEscapeRate
    if (quality.defectRootCause) overrides["defect-root-cause"] = quality.defectRootCause
    if (allocation.investmentAllocation) overrides["investment-allocation"] = allocation.investmentAllocation
  } catch {
    // Jira not connected — keep sample flow/velocity/quality metrics
  }
  // Test Automation Coverage from GitLab CI.
  try {
    const coverage = await computeCoverageMetric()
    if (coverage.testAutomationCoverage) overrides["test-automation-coverage"] = coverage.testAutomationCoverage
  } catch {
    // no coverage ingested — keep sample
  }
  // PR cycle-time breakdown from GitLab merge requests.
  try {
    const pr = await computePrCycleMetric()
    if (pr.prCycleTime) overrides["pr-cycle-time"] = pr.prCycleTime
  } catch {
    // MR data not ready — keep sample
  }
  const live = Object.keys(overrides).length > 0
  const metricConfig = await getMetricConfig()

  return (
    <div className="min-h-screen">
      <AppHeader user={user} active="dashboard" />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
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
          <div className="flex items-center gap-2">
            <a
              href="/api/report/pdf"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <FileDown className="size-4" /> Export PDF
            </a>
            <a
              href="/api/report/csv"
              className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <Sheet className="size-4" /> Export CSV
            </a>
          </div>
        </div>

        <MetricExplorer overrides={overrides} config={metricConfig} />
      </main>
    </div>
  )
}
