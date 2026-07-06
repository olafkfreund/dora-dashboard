"use client"

import * as React from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TrendBadge, type Metric } from "@/components/metrics-data"
import { GradientAreaChart } from "@/components/metric-charts"

export function MetricDialog({
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
            Sample data shown in this preview. Live values are computed from {metric.source} ingestion once
            integrations are connected.
          </p>
        </div>
      </div>
    </div>
  )
}
