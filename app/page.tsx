import { Gauge, Github, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { MetricExplorer } from "@/components/metric-explorer"

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Gauge className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">DORA Dashboard</h1>
              <p className="text-xs text-muted-foreground">
                Delivery intelligence · GitHub + Jira
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Github className="size-4" /> Sign in with GitHub
            </Button>
            <Button size="sm">
              <ShieldCheck className="size-4" /> Sign in with Entra ID
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
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
          Self-hosted · no third-party data egress · Azure Entra ID SSO + GitHub
          OAuth · Docker &amp; Helm. See the roadmap and epic on GitHub for tracked
          work.
        </footer>
      </main>
    </div>
  )
}
