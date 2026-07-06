"use client"

import * as React from "react"
import {
  Activity,
  AlertTriangle,
  Ban,
  Bug,
  Clock,
  FlaskConical,
  Gauge,
  GitPullRequest,
  Hourglass,
  ShieldCheck,
  Target,
  Timer,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type Trend = "up" | "down" | "flat"
type Source = "GitHub" | "Jira" | "GitHub + Jira"

interface Metric {
  id: string
  group: string
  label: string
  value: string
  sub: string
  icon: React.ComponentType<{ className?: string }>
  trend: Trend
  good: "up" | "down"
  source: Source
  target: string
  unit: string
  definition: string
  formula: string
  insight: string
  history: number[]
}

// Sample values for preview only — real values come from GitHub + Jira ingestion.
const metrics: Metric[] = [
  {
    id: "deployment-frequency",
    group: "DORA-4",
    label: "Deployment Frequency",
    value: "14.2/wk",
    sub: "Elite",
    icon: GitPullRequest,
    trend: "up",
    good: "up",
    source: "GitHub",
    target: "≥ 7/wk (Elite)",
    unit: "deploys / week",
    definition:
      "How often the organization successfully releases to production. A core DORA throughput metric; higher generally indicates smaller, safer batches.",
    formula:
      "count(successful production deployments) / weeks in range",
    insight:
      "Trending up over the last 8 weeks — batch sizes are shrinking, which typically correlates with lower change failure rate.",
    history: [8.1, 9.4, 9.0, 10.2, 11.1, 12.6, 13.0, 14.2],
  },
  {
    id: "lead-time-for-changes",
    group: "DORA-4",
    label: "Lead Time for Changes",
    value: "1.8 days",
    sub: "-0.4d vs prev",
    icon: Timer,
    trend: "down",
    good: "down",
    source: "GitHub + Jira",
    target: "< 1 day (Elite)",
    unit: "days",
    definition:
      "Time from code committed to code successfully running in production. Measures delivery pipeline efficiency.",
    formula:
      "median(deployed_at − first_commit_at) across changes in range",
    insight:
      "Improving, but still above the Elite threshold. Largest contributor is review wait time on the payments service.",
    history: [3.1, 2.9, 2.7, 2.5, 2.4, 2.2, 2.2, 1.8],
  },
  {
    id: "change-failure-rate",
    group: "DORA-4",
    label: "Change Failure Rate",
    value: "9.4%",
    sub: "-1.2pp",
    icon: AlertTriangle,
    trend: "down",
    good: "down",
    source: "GitHub",
    target: "≤ 15% (Elite)",
    unit: "%",
    definition:
      "Percentage of deployments causing a failure in production that requires remediation (hotfix, rollback, patch).",
    formula:
      "failed deployments / total deployments × 100",
    insight:
      "Within Elite range and falling. Most failures are concentrated in one legacy component slated for refactor.",
    history: [13.2, 12.8, 12.1, 11.6, 10.9, 10.6, 10.4, 9.4],
  },
  {
    id: "mttr",
    group: "DORA-4",
    label: "Mean Time to Restore",
    value: "2.3 hrs",
    sub: "-18m",
    icon: Activity,
    trend: "down",
    good: "down",
    source: "GitHub + Jira",
    target: "< 1 hr (Elite)",
    unit: "hours",
    definition:
      "How long it takes to restore service after a production incident or failed change.",
    formula:
      "mean(incident_resolved_at − incident_started_at) in range",
    insight:
      "Down 18 minutes vs the previous period. Faster rollback automation is the main driver.",
    history: [3.4, 3.1, 3.0, 2.8, 2.7, 2.6, 2.5, 2.3],
  },
  {
    id: "cycle-time",
    group: "Flow",
    label: "Cycle Time",
    value: "3.1 days",
    sub: "start → release",
    icon: Clock,
    trend: "down",
    good: "down",
    source: "Jira",
    target: "< 3 days",
    unit: "days",
    definition:
      "Time from when work actively starts on an item until it is released. Reflects execution efficiency once work begins.",
    formula:
      "median(released_at − in_progress_at) for completed items",
    insight:
      "Just above target. Testing hand-off is the slowest stage in the value stream.",
    history: [4.3, 4.1, 3.9, 3.7, 3.5, 3.3, 3.2, 3.1],
  },
  {
    id: "work-item-age",
    group: "Flow",
    label: "Work Item Age",
    value: "4.7 days",
    sub: "open items avg",
    icon: Hourglass,
    trend: "up",
    good: "down",
    source: "Jira",
    target: "< 4 days",
    unit: "days",
    definition:
      "Average age of currently open, in-progress work items. A leading indicator of items at risk of stalling.",
    formula:
      "mean(now − in_progress_at) for items still open",
    insight:
      "Rising — 3 items have been in progress for over 10 days and should be reviewed in the next standup.",
    history: [3.8, 3.9, 4.0, 4.2, 4.3, 4.5, 4.6, 4.7],
  },
  {
    id: "blocked-time",
    group: "Flow",
    label: "Blocked Time",
    value: "12%",
    sub: "of item lifetime",
    icon: Ban,
    trend: "down",
    good: "down",
    source: "Jira",
    target: "< 10%",
    unit: "%",
    definition:
      "Percentage of a work item's lifetime spent in a blocked/waiting state. High values indicate dependency or hand-off friction.",
    formula:
      "sum(time in blocked status) / sum(total item lifetime) × 100",
    insight:
      "Slowly improving. Most blocked time is waiting on external API sign-off.",
    history: [18, 17, 16, 15, 14, 13, 13, 12],
  },
  {
    id: "delivery-predictability",
    group: "Flow",
    label: "Delivery Predictability",
    value: "87%",
    sub: "committed vs done",
    icon: Target,
    trend: "up",
    good: "up",
    source: "Jira",
    target: "≥ 85%",
    unit: "%",
    definition:
      "How much of the sprint-committed work is actually completed. Measures planning reliability.",
    formula:
      "completed story points / committed story points × 100",
    insight:
      "Above target and stable — commitments are well-calibrated to capacity.",
    history: [72, 75, 78, 80, 82, 84, 86, 87],
  },
  {
    id: "average-velocity",
    group: "Velocity & Quality",
    label: "Average Velocity",
    value: "42 pts",
    sub: "last 5 sprints",
    icon: Gauge,
    trend: "up",
    good: "up",
    source: "Jira",
    target: "stable trend",
    unit: "story points / sprint",
    definition:
      "Average story points completed per sprint over the last 3–5 sprints. Used for forecasting, not as a target to maximize.",
    formula:
      "mean(completed story points) over last 5 sprints",
    insight:
      "Gently increasing and consistent — a healthy, sustainable signal rather than a spike.",
    history: [34, 36, 35, 38, 39, 40, 41, 42],
  },
  {
    id: "test-automation-coverage",
    group: "Velocity & Quality",
    label: "Test Automation Coverage",
    value: "76%",
    sub: "+3pp",
    icon: FlaskConical,
    trend: "up",
    good: "up",
    source: "GitHub",
    target: "≥ 80%",
    unit: "%",
    definition:
      "Percentage of regression/integration testing that is automated. A leading indicator of release confidence.",
    formula:
      "automated test cases / total test cases × 100",
    insight:
      "Up 3 points; on track to clear the 80% target within two sprints.",
    history: [68, 69, 70, 71, 72, 74, 75, 76],
  },
  {
    id: "defect-escape-rate",
    group: "Velocity & Quality",
    label: "Defect Escape Rate",
    value: "6.1%",
    sub: "post-release",
    icon: Bug,
    trend: "down",
    good: "down",
    source: "GitHub + Jira",
    target: "< 5%",
    unit: "%",
    definition:
      "Share of defects found after release versus before release. Lower means issues are caught earlier.",
    formula:
      "defects found post-release / total defects × 100",
    insight:
      "Falling as automation coverage rises, but still above the 5% target.",
    history: [9.2, 8.7, 8.1, 7.6, 7.1, 6.8, 6.4, 6.1],
  },
  {
    id: "defect-root-cause",
    group: "Velocity & Quality",
    label: "Defect Root Cause",
    value: "31%",
    sub: "upstream rework",
    icon: ShieldCheck,
    trend: "down",
    good: "down",
    source: "Jira",
    target: "< 25%",
    unit: "%",
    definition:
      "Proportion of defects requiring rework due to upstream causes (requirements, design, dependencies).",
    formula:
      "upstream-caused defects / total defects × 100",
    insight:
      "Trending down as refinement improves, but upstream requirements gaps remain the top category.",
    history: [42, 40, 38, 36, 35, 33, 32, 31],
  },
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
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        isGood ? "text-[color:var(--success)]" : "text-destructive"
      )}
    >
      <Icon className="size-3.5" />
    </span>
  )
}

function Sparkline({
  data,
  good,
  trend,
  height = 64,
}: {
  data: number[]
  good: "up" | "down"
  trend: Trend
  height?: number
}) {
  const width = 320
  const pad = 6
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const step = (width - pad * 2) / (data.length - 1)
  const points = data.map((v, i) => {
    const x = pad + i * step
    const y = pad + (1 - (v - min) / span) * (height - pad * 2)
    return [x, y] as const
  })
  const line = points.map(([x, y]) => `${x},${y}`).join(" ")
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`
  const isGood = trend === "flat" ? true : trend === good
  const stroke = isGood ? "var(--success)" : "var(--destructive)"

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-16 w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label="Trend over the last 8 periods"
    >
      <polygon points={area} fill={stroke} opacity={0.12} />
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === points.length - 1 ? 3 : 0} fill={stroke} />
      ))}
    </svg>
  )
}

function MetricDialog({
  metric,
  onClose,
}: {
  metric: Metric
  onClose: () => void
}) {
  const Icon = metric.icon
  const closeRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    closeRef.current?.focus()
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="metric-dialog-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-card text-card-foreground shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Icon className="size-6" />
            </div>
            <div>
              <h2 id="metric-dialog-title" className="text-lg font-semibold leading-tight">
                {metric.label}
              </h2>
              <p className="text-xs text-muted-foreground">
                {metric.group} · source: {metric.source}
              </p>
            </div>
          </div>
          <Button
            ref={closeRef}
            variant="ghost"
            size="icon"
            aria-label="Close details"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-6 p-6">
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-semibold tracking-tight">
                  {metric.value}
                </span>
                <TrendBadge trend={metric.trend} good={metric.good} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{metric.unit}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Target</p>
              <p className="text-sm font-medium">{metric.target}</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Trend · last 8 periods
            </p>
            <Sparkline
              data={metric.history}
              good={metric.good}
              trend={metric.trend}
            />
          </div>

          <div>
            <h3 className="mb-1 text-sm font-semibold">Definition</h3>
            <p className="text-sm text-muted-foreground">{metric.definition}</p>
          </div>

          <div>
            <h3 className="mb-1 text-sm font-semibold">How it&apos;s calculated</h3>
            <code className="block whitespace-pre-wrap rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs">
              {metric.formula}
            </code>
          </div>

          <div>
            <h3 className="mb-1 text-sm font-semibold">Insight</h3>
            <p className="text-sm text-muted-foreground">{metric.insight}</p>
          </div>

          <p className="border-t border-border pt-4 text-xs text-muted-foreground">
            Sample data shown in this preview. Live values are computed from{" "}
            {metric.source} ingestion once integrations are connected.
          </p>
        </div>
      </div>
    </div>
  )
}

export function MetricExplorer() {
  const [openId, setOpenId] = React.useState<string | null>(null)
  const active = metrics.find((m) => m.id === openId) ?? null

  return (
    <>
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
                  <Card
                    key={m.id}
                    role="button"
                    tabIndex={0}
                    aria-haspopup="dialog"
                    onClick={() => setOpenId(m.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        setOpenId(m.id)
                      }
                    }}
                    className="cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
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
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">{m.sub}</p>
                        <span className="text-xs font-medium text-primary">
                          Details →
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
          </div>
        </section>
      ))}

      {active && (
        <MetricDialog metric={active} onClose={() => setOpenId(null)} />
      )}
    </>
  )
}
