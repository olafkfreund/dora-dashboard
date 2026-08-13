"use client"

import * as React from "react"
import { BarChart3, LayoutGrid, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  metrics,
  groups,
  isGood,
  TrendBadge,
  type Metric,
  type MetricBreakdown,
  type SourceLink,
} from "@/components/metrics-data"
import { classifyTier, type TierTone } from "@/lib/metrics/dora-tier"
import type { MetricConfig } from "@/lib/metrics/config"
import {
  CountUp,
  GradientAreaChart,
  MiniViz,
  RadialGauge,
} from "@/components/metric-charts"
import { MetricDialog } from "@/components/metric-dialog"

// Configured DORA benchmark bands, provided once so TierBadge needn't be prop-drilled.
const BandsContext = React.createContext<MetricConfig["bands"] | undefined>(undefined)

type ViewMode = "cards" | "charts" | "modern"
const STORAGE_KEY = "dora-view-mode"

const VIEWS: { id: ViewMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "cards", label: "Cards", icon: LayoutGrid },
  { id: "charts", label: "Charts", icon: BarChart3 },
  { id: "modern", label: "Modern", icon: Sparkles },
]

export type MetricOverride = {
  value: string
  sub: string
  history: number[]
  trend?: "up" | "down" | "flat"
  breakdown?: MetricBreakdown
  note?: string
  sourceLink?: SourceLink
}

type ViewProps = {
  items: Metric[]
  liveIds: Set<string>
  onOpen: (id: string) => void
}

function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[color:var(--success)]">
      <span className="size-1.5 rounded-full bg-[color:var(--success)]" />
      live
    </span>
  )
}

const TIER_CLS: Record<TierTone, string> = {
  elite: "border-emerald-500/30 bg-emerald-500/15 text-emerald-500",
  high: "border-sky-500/30 bg-sky-500/15 text-sky-500",
  medium: "border-amber-500/30 bg-amber-500/15 text-amber-500",
  low: "border-red-500/30 bg-red-500/15 text-red-500",
}

/** DORA performance-tier badge (Elite/High/Medium/Low) — DORA-4 metrics only. */
function TierBadge({ metric }: { metric: Metric }) {
  const bands = React.useContext(BandsContext)
  const t = classifyTier(metric.id, metric.value, bands)
  if (!t) return null
  return (
    <span
      title={`DORA ${t.tier} performer`}
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TIER_CLS[t.tone]}`}
    >
      {t.tier}
    </span>
  )
}

function percentOf(m: Metric): number {
  const n = parseFloat(m.value)
  return isNaN(n) ? 0 : n
}

function clickableProps(onOpen: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    "aria-haspopup": "dialog" as const,
    onClick: onOpen,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        onOpen()
      }
    },
  }
}

/* ---------------- View 1: Cards (original) ---------------- */
function CardsView({ items, liveIds, onOpen }: ViewProps) {
  return (
    <>
      {groups.map((group) => (
        <section key={group} className="mb-10">
          <GroupHeading group={group} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {items
              .filter((m) => m.group === group)
              .map((m) => {
                const Icon = m.icon
                return (
                  <Card
                    key={m.id}
                    {...clickableProps(() => onOpen(m.id))}
                    className="cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
                          <Icon className="size-5" />
                        </div>
                        <div className="flex items-center gap-2">{liveIds.has(m.id) && <LiveDot />}<TierBadge metric={m} /><TrendBadge trend={m.trend} good={m.good} /></div>
                      </div>
                      <CardTitle className="mt-3 text-2xl">{m.value}</CardTitle>
                      <CardDescription>{m.label}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">{m.sub}</p>
                        <span className="text-xs font-medium text-primary">Details →</span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
          </div>
        </section>
      ))}
    </>
  )
}

/* ---------------- View 2: Charts (colored) ---------------- */
function ChartsView({ items, liveIds, onOpen }: ViewProps) {
  return (
    <>
      {groups.map((group) => (
        <section key={group} className="mb-10">
          <GroupHeading group={group} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {items
              .filter((m) => m.group === group)
              .map((m) => {
                const Icon = m.icon
                return (
                  <Card
                    key={m.id}
                    {...clickableProps(() => onOpen(m.id))}
                    className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="h-1 w-full" style={{ backgroundColor: m.accent }} />
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="flex size-8 items-center justify-center rounded-lg text-white"
                            style={{ backgroundColor: m.accent }}
                          >
                            <Icon className="size-4" />
                          </div>
                          <CardDescription className="text-foreground">{m.label}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">{liveIds.has(m.id) && <LiveDot />}<TierBadge metric={m} /><TrendBadge trend={m.trend} good={m.good} /></div>
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <CardTitle className="text-2xl">{m.value}</CardTitle>
                        <span className="text-xs text-muted-foreground">{m.sub}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <MiniViz data={m.history} color={m.accent} height={88} />
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Target: {m.target}</span>
                        <span className="font-medium text-primary">Details →</span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
          </div>
        </section>
      ))}
    </>
  )
}

/* ---------------- View 3: Modern (colorful + animated) ---------------- */
function ModernView({ items, liveIds, onOpen }: ViewProps) {
  return (
    <>
      {groups.map((group) => (
        <section key={group} className="mb-10">
          <GroupHeading group={group} />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {items
              .filter((m) => m.group === group)
              .map((m, i) => {
                const Icon = m.icon
                const usesGauge = m.unit === "%"
                const good = isGood(m.trend, m.good)
                const noData = m.value === "—"
                return (
                  <div
                    key={m.id}
                    {...clickableProps(() => onOpen(m.id))}
                    className="metric-enter group relative cursor-pointer overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={{ animationDelay: `${i * 70}ms` }}
                  >
                    {/* glow accents */}
                    <div
                      className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full opacity-25 blur-3xl transition-opacity group-hover:opacity-50"
                      style={{ backgroundColor: m.accent }}
                    />
                    <div className="relative flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="flex size-9 items-center justify-center rounded-xl text-white shadow-md"
                          style={{ backgroundColor: m.accent }}
                        >
                          <Icon className="size-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-tight">{m.label}</p>
                          <p className="text-[11px] text-muted-foreground">{m.group}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                      {liveIds.has(m.id) && <LiveDot />}
                      <TierBadge metric={m} />
                      {noData ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          no data
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            good
                              ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                              : "bg-destructive/15 text-destructive"
                          )}
                        >
                          {good ? "▲ healthy" : "▼ watch"}
                        </span>
                      )}
                      </div>
                    </div>

                    <div className="relative mt-4 flex items-center justify-between gap-3">
                      {usesGauge ? (
                        <RadialGauge percent={percentOf(m)} color={m.accent} id={`mod-${m.id}`} size={104}>
                          <div className="text-center">
                            <CountUp value={m.value} className="text-lg font-bold" />
                          </div>
                        </RadialGauge>
                      ) : (
                        <div className="flex-1">
                          <CountUp value={m.value} className="text-3xl font-bold tracking-tight" />
                          <p className="mt-0.5 text-xs text-muted-foreground">{m.sub}</p>
                        </div>
                      )}
                      {!usesGauge && (
                        <div className="w-1/2">
                          <GradientAreaChart data={m.history} color={m.accent} id={`mod-${m.id}`} height={72} />
                        </div>
                      )}
                    </div>

                    <div className="relative mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
                      <span>Target: {m.target}</span>
                      <span className="font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                        Details →
                      </span>
                    </div>
                  </div>
                )
              })}
          </div>
        </section>
      ))}
    </>
  )
}

// The four flow KPIs that carry a programme baseline (order = display order).
// Kept as literals so this client module needn't import the zod-backed config.
const BASELINE_IDS = [
  "lead-time-for-changes",
  "cycle-time",
  "delivery-predictability",
  "work-item-age",
] as const

/**
 * Static KPI baseline boxes, rendered on top of the metric cards. The box styling
 * follows the active view (cards / charts / modern) and the theme tokens; the text
 * (baseline number, label, definition) is static and identical across views.
 */
function BaselineRow({
  view,
  baselines,
  currentById,
}: {
  view: ViewMode
  baselines?: MetricConfig["baselines"]
  currentById?: Record<string, string>
}) {
  const items = BASELINE_IDS.map((id) => ({
    id,
    m: metrics.find((x) => x.id === id),
    b: baselines?.[id],
  })).filter((r) => r.m && r.b)
  if (items.length === 0) return null

  // Match each view's card column count (cards = 4-up, charts/modern = 2-up).
  const grid = view === "cards" ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2"

  return (
    <div className={cn("mb-8 grid grid-cols-1 gap-4", grid)}>
      {items.map(({ id, m, b }) => {
        const Icon = m!.icon
        const label = m!.label
        const accent = m!.accent
        // Baseline + 12-week Target are static (programme goals); Current is live.
        const rows: [string, string, boolean][] = [
          ["Baseline", b!.baseline, false],
          ["Target", b!.week12, false],
          ["Current", currentById?.[id] ?? "—", true],
        ]
        const text = (
          <>
            <p className="text-sm font-semibold text-card-foreground">{label}</p>
            <dl className="mt-3 w-full space-y-1.5">
              {rows.map(([k, v, isCurrent]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {k}
                  </dt>
                  <dd
                    className="text-sm font-bold tabular-nums"
                    style={isCurrent ? { color: accent } : undefined}
                  >
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs leading-snug text-muted-foreground">{b!.note}</p>
          </>
        )

        if (view === "modern") {
          return (
            <div
              key={id}
              className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-center shadow-sm"
            >
              <div
                className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full opacity-25 blur-3xl"
                style={{ backgroundColor: accent }}
              />
              <div className="relative flex flex-col items-center">
                <div
                  className="mb-3 flex size-9 items-center justify-center rounded-xl text-white shadow-md"
                  style={{ backgroundColor: accent }}
                >
                  <Icon className="size-5" />
                </div>
                {text}
              </div>
            </div>
          )
        }

        if (view === "charts") {
          return (
            <Card key={id} className="overflow-hidden text-center">
              <div className="h-1 w-full" style={{ backgroundColor: accent }} />
              <div className="flex flex-col items-center px-4 py-5">
                <div
                  className="mb-3 flex size-9 items-center justify-center rounded-lg text-white"
                  style={{ backgroundColor: accent }}
                >
                  <Icon className="size-5" />
                </div>
                {text}
              </div>
            </Card>
          )
        }

        // cards (default)
        return (
          <Card key={id} className="flex flex-col items-center px-4 py-5 text-center">
            <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
              <Icon className="size-5" />
            </div>
            {text}
          </Card>
        )
      })}
    </div>
  )
}

function GroupHeading({ group }: { group: string }) {
  return (
    <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      {group}
    </h3>
  )
}

export function MetricExplorer({
  overrides,
  config,
}: {
  overrides?: Record<string, MetricOverride>
  config?: MetricConfig
}) {
  const [view, setView] = React.useState<ViewMode>("cards")
  const [openId, setOpenId] = React.useState<string | null>(null)

  // Apply live overrides (real GitLab-computed metrics) onto the sample set.
  const items = React.useMemo<Metric[]>(() => {
    const hidden = new Set(config?.hiddenMetrics ?? [])
    return metrics
      .filter((m) => !hidden.has(m.id))
      .map((m) => {
        const o = overrides?.[m.id]
        return o
          ? { ...m, value: o.value, sub: o.sub, history: o.history, trend: o.trend ?? m.trend, breakdown: o.breakdown, note: o.note, sourceLink: o.sourceLink }
          : m
      })
  }, [overrides, config])
  const liveIds = React.useMemo(() => new Set(Object.keys(overrides ?? {})), [overrides])
  const active = items.find((m) => m.id === openId) ?? null

  // Deep-link support (?view=&metric=) takes precedence over persisted view.
  // Intentional one-shot sync from the URL/localStorage (external state) that
  // must run AFTER hydration to avoid a server/client mismatch — the documented
  // valid use of an effect, so the set-state-in-effect rule is disabled here.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const qView = params.get("view") as ViewMode | null
    if (qView && VIEWS.some((v) => v.id === qView)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView(qView)
    } else {
      const saved = window.localStorage.getItem(STORAGE_KEY) as ViewMode | null
      if (saved && VIEWS.some((v) => v.id === saved)) setView(saved)
    }
    const qMetric = params.get("metric")
    if (qMetric && metrics.some((m) => m.id === qMetric)) setOpenId(qMetric)
  }, [])

  const changeView = (v: ViewMode) => {
    setView(v)
    window.localStorage.setItem(STORAGE_KEY, v)
  }

  const onOpen = (id: string) => setOpenId(id)

  return (
    <BandsContext.Provider value={config?.bands}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {view === "cards" && "Compact cards — click any metric for details."}
          {view === "charts" && "Colored per-metric charts."}
          {view === "modern" && "Animated, colorful visual view."}
        </p>
        <div
          role="tablist"
          aria-label="Metric view"
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1"
        >
          {VIEWS.map((v) => {
            const Icon = v.icon
            const activeTab = view === v.id
            return (
              <button
                key={v.id}
                role="tab"
                aria-selected={activeTab}
                onClick={() => changeView(v.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  activeTab
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                {v.label}
              </button>
            )
          })}
        </div>
      </div>

      <BaselineRow
        view={view}
        baselines={config?.baselines}
        currentById={Object.fromEntries(items.map((m) => [m.id, m.value]))}
      />

      {view === "cards" && <CardsView items={items} liveIds={liveIds} onOpen={onOpen} />}
      {view === "charts" && <ChartsView items={items} liveIds={liveIds} onOpen={onOpen} />}
      {view === "modern" && <ModernView items={items} liveIds={liveIds} onOpen={onOpen} />}

      {active && <MetricDialog metric={active} config={config} onClose={() => setOpenId(null)} />}
    </BandsContext.Provider>
  )
}
