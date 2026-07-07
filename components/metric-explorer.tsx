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
} from "@/components/metrics-data"
import {
  BarChart,
  CountUp,
  GradientAreaChart,
  RadialGauge,
} from "@/components/metric-charts"
import { MetricDialog } from "@/components/metric-dialog"

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
                        <div className="flex items-center gap-2">{liveIds.has(m.id) && <LiveDot />}<TrendBadge trend={m.trend} good={m.good} /></div>
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
                        <div className="flex items-center gap-2">{liveIds.has(m.id) && <LiveDot />}<TrendBadge trend={m.trend} good={m.good} /></div>
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <CardTitle className="text-2xl">{m.value}</CardTitle>
                        <span className="text-xs text-muted-foreground">{m.sub}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <BarChart data={m.history} color={m.accent} height={88} />
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

function GroupHeading({ group }: { group: string }) {
  return (
    <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      {group}
    </h3>
  )
}

export function MetricExplorer({
  overrides,
}: {
  overrides?: Record<string, MetricOverride>
}) {
  const [view, setView] = React.useState<ViewMode>("cards")
  const [openId, setOpenId] = React.useState<string | null>(null)

  // Apply live overrides (real GitLab-computed metrics) onto the sample set.
  const items = React.useMemo<Metric[]>(
    () =>
      metrics.map((m) => {
        const o = overrides?.[m.id]
        return o
          ? { ...m, value: o.value, sub: o.sub, history: o.history, trend: o.trend ?? m.trend }
          : m
      }),
    [overrides]
  )
  const liveIds = React.useMemo(() => new Set(Object.keys(overrides ?? {})), [overrides])
  const active = items.find((m) => m.id === openId) ?? null

  // Deep-link support (?view=&metric=) takes precedence over persisted view.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const qView = params.get("view") as ViewMode | null
    if (qView && VIEWS.some((v) => v.id === qView)) {
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
    <>
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

      {view === "cards" && <CardsView items={items} liveIds={liveIds} onOpen={onOpen} />}
      {view === "charts" && <ChartsView items={items} liveIds={liveIds} onOpen={onOpen} />}
      {view === "modern" && <ModernView items={items} liveIds={liveIds} onOpen={onOpen} />}

      {active && <MetricDialog metric={active} onClose={() => setOpenId(null)} />}
    </>
  )
}
