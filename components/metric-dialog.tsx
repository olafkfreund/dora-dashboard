"use client"

import * as React from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TrendBadge, type Metric } from "@/components/metrics-data"
import { GradientAreaChart } from "@/components/metric-charts"
import { classifyTier } from "@/lib/metrics/dora-tier"
import type { MetricConfig, DoraMetricId } from "@/lib/metrics/config"

const TIER_CLS = {
  elite: "border-emerald-500/30 bg-emerald-500/15 text-emerald-500",
  high: "border-sky-500/30 bg-sky-500/15 text-sky-500",
  medium: "border-amber-500/30 bg-amber-500/15 text-amber-500",
  low: "border-red-500/30 bg-red-500/15 text-red-500",
} as const

const DORA_IDS = new Set(["deployment-frequency", "lead-time-for-changes", "change-failure-rate", "mttr"])

export function MetricDialog({
  metric,
  config,
  onClose,
}: {
  metric: Metric
  config?: MetricConfig
  onClose: () => void
}) {
  const Icon = metric.icon
  const closeRef = React.useRef<HTMLButtonElement>(null)
  const bands = config?.bands
  const isDora = DORA_IDS.has(metric.id)

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
        className="metric-dialog-panel max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-card text-card-foreground shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-6">
          <div className="flex items-center gap-3">
            <div
              className="flex size-11 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: metric.accent }}
            >
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
          <Button ref={closeRef} variant="ghost" size="icon" aria-label="Close details" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-6 p-6">
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-semibold tracking-tight">{metric.value}</span>
                {(() => {
                  const t = classifyTier(metric.id, metric.value, bands)
                  return t ? (
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TIER_CLS[t.tone]}`}>
                      {t.tier}
                    </span>
                  ) : null
                })()}
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
            <GradientAreaChart data={metric.history} color={metric.accent} id={`dlg-${metric.id}`} height={96} />
          </div>

          {metric.note && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <div>
                <p className="text-sm font-medium">Why this value</p>
                <p className="mt-0.5 text-sm text-foreground/90">{metric.note}</p>
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-1 text-sm font-semibold">Definition</h3>
            <p className="text-sm text-muted-foreground">{metric.definition}</p>
          </div>

          <div>
            <h3 className="mb-1 text-sm font-semibold">Data source</h3>
            <p className="text-sm text-muted-foreground">{metric.sourceDetail}</p>
          </div>

          <div>
            <h3 className="mb-1 text-sm font-semibold">How it&apos;s calculated</h3>
            <code className="block whitespace-pre-wrap rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs">
              {metric.formula}
            </code>
          </div>

          {isDora && config && (
            <div>
              <h3 className="mb-1 text-sm font-semibold">Active rules · lineage</h3>
              <p className="mb-2 text-xs text-muted-foreground">
                The current configured definition behind this number (Settings → Metrics).
              </p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Rolling window</dt>
                <dd>{config.windowWeeks} weeks</dd>
                <dt className="text-muted-foreground">Environments</dt>
                <dd>
                  {config.deployment.environments.length
                    ? config.deployment.environments.join(", ")
                    : "all environments"}
                </dd>
                <dt className="text-muted-foreground">Ref pattern</dt>
                <dd className="font-mono">{config.deployment.refPattern ?? "any"}</dd>
                <dt className="text-muted-foreground">Failure statuses</dt>
                <dd>{config.deployment.failureStatuses.join(", ")}</dd>
                {(() => {
                  const b = bands?.[metric.id as DoraMetricId]
                  return b ? (
                    <>
                      <dt className="text-muted-foreground">Bands ({metric.unit})</dt>
                      <dd>
                        Elite {b.elite} · High {b.high} · Medium {b.medium}
                      </dd>
                    </>
                  ) : null
                })()}
              </dl>
            </div>
          )}

          {metric.breakdown && metric.breakdown.rows.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold">{metric.breakdown.title}</h3>
              <p className="mb-2 text-xs text-muted-foreground">
                The underlying data behind this number.
              </p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      {metric.breakdown.columns.map((c, i) => (
                        <th
                          key={c}
                          className={`px-3 py-2 font-medium ${i === 0 ? "text-left" : "text-right"}`}
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {metric.breakdown.rows.map((r) => (
                      <tr key={r.label} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-mono text-xs">{r.label}</td>
                        {r.values.map((v, i) => (
                          <td key={i} className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-1 text-sm font-semibold">Insight</h3>
            <p className="text-sm text-muted-foreground">{metric.insight}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
