"use client"

import { useActionState } from "react"
import { useRouter } from "next/navigation"
import { RotateCcw, SlidersHorizontal, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field } from "@/components/ui/labeled-input"
import { FormMessage } from "@/components/ui/form-message"
import type { MetricConfig } from "@/lib/metrics/config"
import { metrics as allCards, groups } from "@/lib/metrics/catalog"
import { saveMetricConfigAction, resetMetricConfigAction } from "./metric-config-actions"

// Local band metadata (labels/units) — avoids importing the zod-backed config module client-side.
const BAND_ROWS = [
  { id: "deployment-frequency", label: "Deployment Frequency", unit: "deploys / week", hint: "higher = better" },
  { id: "lead-time-for-changes", label: "Lead Time for Changes", unit: "days", hint: "lower = better" },
  { id: "change-failure-rate", label: "Change Failure Rate", unit: "%", hint: "lower = better" },
  { id: "mttr", label: "Mean Time to Restore", unit: "hours", hint: "lower = better" },
] as const

export function MetricsPanel({
  config,
  teams = [],
  currentTeam,
}: {
  config: MetricConfig
  teams?: { slug: string; name: string }[]
  currentTeam?: string
}) {
  const [save, saveAction, saving] = useActionState(saveMetricConfigAction, undefined)
  const [reset, resetAction, resetting] = useActionState(resetMetricConfigAction, undefined)
  const router = useRouter()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
              <SlidersHorizontal className="size-4" />
            </div>
            <CardTitle className="text-base">
              Metric definitions{" "}
              <span className="text-xs font-normal text-muted-foreground">
                · {currentTeam ? `team "${currentTeam}" (overrides org)` : "org default (all teams)"}
              </span>
            </CardTitle>
          </div>
          {teams.length > 0 && (
            <label className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs">
              <Users className="size-3.5 text-muted-foreground" />
              <select
                aria-label="Configure metrics for team"
                value={currentTeam ?? "org"}
                onChange={(e) => {
                  const v = e.target.value
                  router.push(v === "org" ? "/settings" : `/settings?metricsTeam=${encodeURIComponent(v)}`)
                }}
                className="bg-background text-xs font-medium text-foreground outline-none"
              >
                <option value="org" className="bg-background text-foreground">
                  Org default
                </option>
                {teams.map((t) => (
                  <option key={t.slug} value={t.slug} className="bg-background text-foreground">
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={saveAction} className="space-y-6">
          <input type="hidden" name="team" value={currentTeam ?? ""} />
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
              label="Jira statuses that count as Blocked (comma-separated; empty = auto-detect by name)"
              name="blockedStatuses"
              defaultValue={config.blockedStatuses.join(", ")}
              placeholder="Blocked, Defect Blocked, On Hold"
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
            <div className="space-y-1.5">
              <label htmlFor="mttrMode" className="text-sm font-medium">
                MTTR source
              </label>
              <select
                id="mttrMode"
                name="mttrMode"
                defaultValue={config.mttrMode}
                className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="proxy" className="bg-background text-foreground">
                  Deploy-recovery proxy (failed → next success)
                </option>
                <option value="incident" className="bg-background text-foreground">
                  GitLab incidents (close − open) — falls back to proxy if none
                </option>
              </select>
            </div>
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

          {/* Card visibility */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Visible cards</h3>
            <p className="text-xs text-muted-foreground">
              Untick a metric to hide its card from the dashboard{currentTeam ? ` for team "${currentTeam}"` : ""}.
            </p>
            {groups.map((g) => (
              <div key={g}>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{g}</p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {allCards
                    .filter((m) => m.group === g)
                    .map((m) => (
                      <label key={m.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="visibleCards"
                          value={m.id}
                          defaultChecked={!config.hiddenMetrics.includes(m.id)}
                          className="size-3.5"
                        />
                        {m.label}
                      </label>
                    ))}
                </div>
              </div>
            ))}
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
          <input type="hidden" name="team" value={currentTeam ?? ""} />
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
