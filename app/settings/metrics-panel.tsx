"use client"

import { useActionState } from "react"
import { RotateCcw, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field } from "@/components/ui/labeled-input"
import { FormMessage } from "@/components/ui/form-message"
import type { MetricConfig } from "@/lib/metrics/config"
import { saveMetricConfigAction, resetMetricConfigAction } from "./metric-config-actions"

// Local band metadata (labels/units) — avoids importing the zod-backed config module client-side.
const BAND_ROWS = [
  { id: "deployment-frequency", label: "Deployment Frequency", unit: "deploys / week", hint: "higher = better" },
  { id: "lead-time-for-changes", label: "Lead Time for Changes", unit: "days", hint: "lower = better" },
  { id: "change-failure-rate", label: "Change Failure Rate", unit: "%", hint: "lower = better" },
  { id: "mttr", label: "Mean Time to Restore", unit: "hours", hint: "lower = better" },
] as const

export function MetricsPanel({ config }: { config: MetricConfig }) {
  const [save, saveAction, saving] = useActionState(saveMetricConfigAction, undefined)
  const [reset, resetAction, resetting] = useActionState(resetMetricConfigAction, undefined)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
            <SlidersHorizontal className="size-4" />
          </div>
          <CardTitle className="text-base">
            Metric definitions{" "}
            <span className="text-xs font-normal text-muted-foreground">· applies to all teams</span>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={saveAction} className="space-y-6">
          {/* What counts as a deployment / change failure */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">What counts as a deployment</h3>
            <Field
              label="Production environments (comma-separated; blank = all)"
              name="environments"
              defaultValue={config.deployment.environments.join(", ")}
              placeholder="production, prod"
            />
            <Field
              label="Ref / branch pattern (regex; blank = any)"
              name="refPattern"
              defaultValue={config.deployment.refPattern ?? ""}
              placeholder="^(main|release/.*)$"
            />
            <Field
              label="Statuses that count as a change failure (comma-separated)"
              name="failureStatuses"
              defaultValue={config.deployment.failureStatuses.join(", ")}
              placeholder="failed"
            />
            <Field
              label="Rolling window (weeks)"
              name="windowWeeks"
              type="number"
              min={1}
              max={52}
              step={1}
              defaultValue={config.windowWeeks}
              className="max-w-32"
            />
          </div>

          {/* Benchmark bands per DORA metric */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Benchmark bands</h3>
            <p className="text-xs text-muted-foreground">
              Thresholds for the Elite / High / Medium tiers (Low is anything beyond Medium).
            </p>
            <div className="space-y-4">
              {BAND_ROWS.map((row) => {
                const b = config.bands[row.id]
                return (
                  <div key={row.id} className="rounded-lg border border-border p-3">
                    <div className="mb-2 flex items-baseline justify-between">
                      <span className="text-sm font-medium">{row.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {row.unit} · {row.hint}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Elite" name={`band:${row.id}:elite`} type="number" step="any" defaultValue={b.elite} />
                      <Field label="High" name={`band:${row.id}:high`} type="number" step="any" defaultValue={b.high} />
                      <Field label="Medium" name={`band:${row.id}:medium`} type="number" step="any" defaultValue={b.medium} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save definitions"}
            </Button>
            <div className="flex-1">
              <FormMessage state={save} />
            </div>
          </div>
        </form>

        <form action={resetAction} className="flex items-center gap-3 border-t border-border pt-4">
          <Button type="submit" size="sm" variant="outline" disabled={resetting}>
            <RotateCcw className={resetting ? "size-4 animate-spin" : "size-4"} />
            {resetting ? "Resetting…" : "Reset to DORA defaults"}
          </Button>
          <div className="flex-1">
            <FormMessage state={reset} />
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
