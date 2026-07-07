import { requireUser } from "@/lib/auth-helpers"
import { AppHeader } from "@/components/app-header"
import { MetricExplorer, type MetricOverride } from "@/components/metric-explorer"
import { computeDora } from "@/lib/metrics/dora"

export default async function Home() {
  const user = await requireUser()

  // Real DORA-4 from ingested GitLab deployments (falls back to sample if none).
  let overrides: Record<string, MetricOverride> = {}
  try {
    const dora = await computeDora()
    if (dora.hasData) {
      if (dora.deploymentFrequency) overrides["deployment-frequency"] = dora.deploymentFrequency
      if (dora.changeFailureRate) overrides["change-failure-rate"] = dora.changeFailureRate
      if (dora.leadTime) overrides["lead-time-for-changes"] = dora.leadTime
      if (dora.mttr) overrides["mttr"] = dora.mttr
    }
  } catch {
    overrides = {}
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
