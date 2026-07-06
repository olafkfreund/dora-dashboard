import { requireUser } from "@/lib/auth-helpers"
import { AppHeader } from "@/components/app-header"
import { MetricExplorer } from "@/components/metric-explorer"

export default async function Home() {
  const user = await requireUser()

  return (
    <div className="min-h-screen">
      <AppHeader user={user} active="dashboard" />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-2">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-[color:var(--success)]" />
            Preview build · sample data · running on port 8191
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Delivery performance overview
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            DORA-4 plus Synechron&apos;s extended delivery and quality metrics,
            unified from GitHub and Jira in a self-hosted, audit-ready portal for
            regulated environments.{" "}
            <span className="text-foreground">Click any metric for details.</span>
          </p>
        </div>

        <MetricExplorer />

        <footer className="mt-6 border-t border-border pt-6 text-xs text-muted-foreground">
          Self-hosted · no third-party data egress · team-level metrics only (no
          individual ranking) · Azure Entra ID SSO + GitHub OAuth · Docker &amp; Helm.
        </footer>
      </main>
    </div>
  )
}
