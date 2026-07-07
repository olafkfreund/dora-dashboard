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
          <p className="max-w-2xl text-sm text-muted-foreground">
            DORA-4 (from GitLab) plus Synechron&apos;s extended delivery and quality
            metrics in a self-hosted, audit-ready portal for regulated environments.{" "}
            <span className="text-foreground">Click any metric for details.</span>
          </p>
        </div>

        <MetricExplorer overrides={overrides} />

        <footer className="mt-6 border-t border-border pt-6 text-xs text-muted-foreground">
          Self-hosted · no third-party data egress · team-level metrics only (no
          individual ranking) · Azure Entra ID SSO + GitHub OAuth · Docker &amp; Helm.
        </footer>
      </main>
    </div>
  )
}
