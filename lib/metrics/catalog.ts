// Pure metric catalog (data + types) — NO "use client", so both client components
// and server code (e.g. the PDF/CSV report) can import the real values.
import type * as React from "react"
import {
  Activity,
  AlertTriangle,
  Ban,
  Bug,
  Clock,
  FlaskConical,
  Gauge,
  GitMerge,
  GitPullRequest,
  Hourglass,
  Layers,
  PieChart,
  ShieldCheck,
  Target,
  Timer,
} from "lucide-react"
import type { MetricBreakdown, SourceLink } from "@/lib/metrics/breakdown"

export type { MetricBreakdown, SourceLink }

export type Trend = "up" | "down" | "flat"
export type Source =
  | "GitLab"
  | "GitHub"
  | "Jira"
  | "GitLab + Jira"
  | "GitHub + Jira"

export interface Metric {
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
  /** Vivid accent color for chart/modern views (hex). */
  accent: string
  /** Where the number comes from (system + entities), shown in the detail modal. */
  sourceDetail: string
  /** Optional underlying-data breakdown for the detail modal. */
  breakdown?: MetricBreakdown
  /** Optional data-aware explanation (e.g. why a value is 0), shown in the detail modal. */
  note?: string
  /** Optional deep-link to the underlying items in GitLab/Jira. */
  sourceLink?: SourceLink
}

// Vivid per-metric accent palette (used by the Charts and Modern views).
const ACCENTS = [
  "#6366f1", // indigo
  "#0ea5e9", // sky
  "#ef4444", // red
  "#f59e0b", // amber
  "#14b8a6", // teal
  "#a855f7", // purple
  "#ec4899", // pink
  "#22c55e", // green
  "#eab308", // yellow
  "#3b82f6", // blue
  "#f97316", // orange
  "#8b5cf6", // violet
]

const base: Omit<Metric, "accent" | "sourceDetail">[] = [
  {
    id: "deployment-frequency",
    group: "DORA-4",
    label: "Deployment Frequency",
    value: "14.2/wk",
    sub: "Elite",
    icon: GitPullRequest,
    trend: "up",
    good: "up",
    source: "GitLab",
    target: "≥ 7/wk (Elite)",
    unit: "deploys / week",
    definition:
      "How often the organization successfully releases to production. A core DORA throughput metric; higher generally indicates smaller, safer batches.",
    formula: "count(successful production deployments) / weeks in range",
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
    source: "GitLab + Jira",
    target: "< 1 day (Elite)",
    unit: "days",
    definition:
      "Time from code committed to code successfully running in production. Measures delivery pipeline efficiency.",
    formula: "median(deployed_at − first_commit_at) across changes in range",
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
    source: "GitLab",
    target: "≤ 15% (Elite)",
    unit: "%",
    definition:
      "Percentage of deployments causing a failure in production that requires remediation (hotfix, rollback, patch).",
    formula: "failed deployments / total deployments × 100",
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
    source: "GitLab + Jira",
    target: "< 1 hr (Elite)",
    unit: "hours",
    definition:
      "How long it takes to restore service after a production incident or failed change.",
    formula: "median(next successful deploy − failed deploy); or incident close − open when MTTR source = incidents",
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
    formula: "median(resolved − work-started) for completed items (Stories/Tasks/Bugs — excludes sub-tasks)",
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
    formula: "mean(now − in_progress_at) for items still open",
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
    formula: "sum(time in blocked status) / sum(total item lifetime) × 100",
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
      "How much of the Program-Increment-committed work is actually completed. Measures planning reliability.",
    formula: "completed ÷ committed story points × 100, per Program Increment (mean across PIs)",
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
      "Average story points completed per Program Increment (P1–P6). Used for forecasting, not as a target to maximize.",
    formula: "mean(completed story points) per Program Increment (P1–P6)",
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
    source: "GitLab",
    target: "≥ 80%",
    unit: "%",
    definition:
      "Percentage of regression/integration testing that is automated. A leading indicator of release confidence.",
    formula: "mean of each project's latest GitLab CI pipeline coverage %",
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
    source: "GitLab + Jira",
    target: "< 5%",
    unit: "%",
    definition:
      "Share of defects found after release versus before release. Lower means issues are caught earlier.",
    formula: "defects with Environment Type = Production ÷ defects with an environment × 100",
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
    formula: "requirements+design ÷ triaged defects × 100, from the Root Cause Analysis field",
    insight:
      "Trending down as refinement improves, but upstream requirements gaps remain the top category.",
    history: [42, 40, 38, 36, 35, 33, 32, 31],
  },
  {
    id: "investment-allocation",
    group: "Velocity & Quality",
    label: "Investment Allocation",
    value: "62% feature",
    sub: "KTLO 18% · Debt 12% · Support 8%",
    icon: PieChart,
    trend: "flat",
    good: "up",
    source: "Jira",
    target: "≥ 60% feature",
    unit: "% of effort",
    definition:
      "How engineering effort splits across new feature work, keep-the-lights-on (KTLO), tech-debt, and support — the delivery investment mix.",
    formula: "story points per category / total story points × 100",
    insight:
      "Feature investment is healthy; watch tech-debt if it climbs above ~15% of effort.",
    history: [58, 59, 60, 61, 60, 62, 61, 62],
  },
  {
    id: "pr-cycle-time",
    group: "Flow",
    label: "PR Cycle Time",
    value: "1.6 days",
    sub: "Code 4h · Pickup 6h · Review 1.1d · Deploy 2h",
    icon: GitMerge,
    trend: "down",
    good: "down",
    source: "GitLab",
    target: "< 1 day",
    unit: "days",
    definition:
      "Time from a change's first commit to merge, broken into Coding, Pickup, Review and Deploy stages — pinpoints where merge requests wait.",
    formula: "median per stage across merged MRs (coding → pickup → review → deploy)",
    insight:
      "Review wait is typically the largest stage — reviewer SLAs or smaller MRs move it the most.",
    history: [2.2, 2.1, 2.0, 1.9, 1.8, 1.7, 1.6, 1.6],
  },
  {
    id: "feature-cycle-time",
    group: "Flow",
    label: "Feature Cycle Time",
    value: "24 days",
    sub: "median · per parent Feature",
    icon: Layers,
    trend: "down",
    good: "down",
    source: "Jira",
    target: "< 1 PI",
    unit: "days",
    definition:
      "How long a Feature (the parent issue) takes from work-started to done. Rolls the story-level flow up to the delivery unit stakeholders track.",
    formula: "median(resolved − work-started) across resolved Features",
    insight:
      "Long-running Features usually span multiple Program Increments — the breakdown lists the slowest with their PI.",
    history: [30, 29, 28, 27, 26, 25, 24, 24],
  },
]

// Where each metric's number comes from — shown in the detail modal for provenance.
const SOURCE_DETAIL: Record<string, string> = {
  "deployment-frequency": "GitLab — count of successful production deployments, divided by the weeks in the rolling window.",
  "lead-time-for-changes": "GitLab — median time from a change's first commit (matched via its merge request) to the production deployment that shipped it.",
  "change-failure-rate": "GitLab — deployments whose status counts as a failure, divided by all considered deployments in the window.",
  mttr: "GitLab — median time from a failed deployment to the next successful deployment of the same project (deploy-recovery proxy).",
  "cycle-time": "Jira — median of (resolved − work-started) across issues completed in the window, from status-change history.",
  "work-item-age": "Jira — mean age of currently open, in-progress issues (now − work-started), from status history.",
  "blocked-time": "Jira — total time issues spent in a blocked/impediment status, as a share of total item lifetime.",
  "delivery-predictability": "Jira — completed vs committed story points per Program Increment (P1–P6).",
  "average-velocity": "Jira — mean completed story points per Program Increment (P1–P6); needs story-pointed issues.",
  "test-automation-coverage": "GitLab CI — mean of each project's latest pipeline coverage value.",
  "defect-escape-rate": "Jira — defects whose Environment Type is Production, divided by defects with an environment set.",
  "defect-root-cause": "Jira — defects grouped by the Root Cause Analysis field; headline = requirements+design share of triaged defects.",
  "investment-allocation": "Jira — story points (unpointed issues weighted as 1) split across feature / KTLO / tech-debt / support by issue type + labels.",
  "pr-cycle-time": "GitLab — merged merge requests broken into Coding, Pickup, Review and Deploy stages (median per stage).",
  "feature-cycle-time": "Jira — median (resolved − work-started) across resolved Features (the parent issue type), with Program Increment.",
}

export const metrics: Metric[] = base.map((m, i) => ({
  ...m,
  accent: ACCENTS[i % ACCENTS.length],
  sourceDetail: SOURCE_DETAIL[m.id] ?? `Source: ${m.source}`,
}))

export const groups = ["DORA-4", "Flow", "Velocity & Quality"] as const

export function isGood(trend: Trend, good: "up" | "down") {
  return trend === "flat" ? true : trend === good
}
