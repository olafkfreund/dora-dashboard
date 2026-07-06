import {
  Activity,
  AlertTriangle,
  Clock,
  GitPullRequest,
  Github,
  Gauge,
  ShieldCheck,
  Timer,
  TrendingDown,
  TrendingUp,
  Bug,
  FlaskConical,
  Hourglass,
  Ban,
  Target,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"

type Trend = "up" | "down" | "flat"

interface Metric {
  label: string
  value: string
  sub: string
  icon: React.ComponentType<{ className?: string }>
  trend: Trend
  good: "up" | "down"
  group: string
}

// Sample values for preview only — real values come from GitHub + Jira ingestion.
const metrics: Metric[] = [
  { group: "DORA-4", label: "Deployment Frequency", value: "14.2/wk", sub: "Elite", icon: GitPullRequest, trend: "up", good: "up" },
  { group: "DORA-4", label: "Lead Time for Changes", value: "1.8 days", sub: "-0.4d vs prev", icon: Timer, trend: "down", good: "down" },
  { group: "DORA-4", label: "Change Failure Rate", value: "9.4%", sub: "-1.2pp", icon: AlertTriangle, trend: "down", good: "down" },
  { group: "DORA-4", label: "Mean Time to Restore", value: "2.3 hrs", sub: "-18m", icon: Activity, trend: "down", good: "down" },
  { group: "Flow", label: "Cycle Time", value: "3.1 days", sub: "start → release", icon: Clock, trend: "down", good: "down" },
  { group: "Flow", label: "Work Item Age", value: "4.7 days", sub: "open items avg", icon: Hourglass, trend: "up", good: "down" },
  { group: "Flow", label: "Blocked Time", value: "12%", sub: "of item lifetime", icon: Ban, trend: "down", good: "down" },
  { group: "Flow", label: "Delivery Predictability", value: "87%", sub: "committed vs done", icon: Target, trend: "up", good: "up" },
  { group: "Velocity & Quality", label: "Average Velocity", value: "42 pts", sub: "last 5 sprints", icon: Gauge, trend: "up", good: "up" },
  { group: "Velocity & Quality", label: "Test Automation Coverage", value: "76%", sub: "+3pp", icon: FlaskConical, trend: "up", good: "up" },
  { group: "Velocity & Quality", label: "Defect Escape Rate", value: "6.1%", sub: "post-release", icon: Bug, trend: "down", good: "down" },
  { group: "Velocity & Quality", label: "Defect Root Cause", value: "31%", sub: "upstream rework", icon: ShieldCheck, trend: "down", good: "down" },
]

const groups = ["DORA-4", "Flow", "Velocity & Quality"]

function TrendBadge({ trend, good }: { trend: Trend; good: "up" | "down" }) {
  if (trend === "flat") {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  const isGood = trend === good
  const Icon = trend === "up" ? TrendingUp : TrendingDown
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        isGood ? "text-[color:var(--success)]" : "text-destructive"
      }`}
    >
      <Icon className="size-3.5" />
    </span>
  )
}

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
            regulated environments.
          </p>
        </div>

        {groups.map((group) => (
          <section key={group} className="mb-10">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {group}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {metrics
                .filter((m) => m.group === group)
                .map((m) => {
                  const Icon = m.icon
                  return (
                    <Card key={m.label} className="transition-shadow hover:shadow-md">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
                            <Icon className="size-5" />
                          </div>
                          <TrendBadge trend={m.trend} good={m.good} />
                        </div>
                        <CardTitle className="mt-3 text-2xl">{m.value}</CardTitle>
                        <CardDescription>{m.label}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground">{m.sub}</p>
                      </CardContent>
                    </Card>
                  )
                })}
            </div>
          </section>
        ))}

        <footer className="mt-6 border-t border-border pt-6 text-xs text-muted-foreground">
          Self-hosted · no third-party data egress · Azure Entra ID SSO + GitHub
          OAuth · Docker &amp; Helm. See the roadmap and epic on GitHub for tracked
          work.
        </footer>
      </main>
    </div>
  )
}
