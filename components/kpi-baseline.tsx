// Static "KPI Baseline & Targets" panel — the customer's transformation goalposts
// (baseline → 9 weeks → 12 weeks). These are reference targets, NOT the live computed
// metric values; the numbers come from the org metric config (editable in Settings).
import { metrics } from "@/lib/metrics/catalog"
import { BASELINE_METRIC_IDS, type MetricConfig } from "@/lib/metrics/config"

const byId = new Map(metrics.map((m) => [m.id, m]))

export function KpiBaseline({ config }: { config: MetricConfig }) {
  // Only render metrics that both exist in the catalog and have baseline data.
  const rows = BASELINE_METRIC_IDS.map((id) => ({
    id,
    metric: byId.get(id),
    b: config.baselines[id],
  })).filter((r) => r.metric && r.b)

  if (rows.length === 0) return null

  return (
    <section className="mb-10">
      <div className="mb-4 flex flex-col gap-1">
        <h3 className="text-lg font-semibold tracking-tight">KPI Baseline &amp; Targets</h3>
        <p className="text-xs text-muted-foreground">
          Programme goalposts (baseline &rarr; 9 weeks &rarr; 12 weeks). Static reference
          targets, not live values &mdash; editable in Settings.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Static baseline boxes */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rows.map(({ id, metric, b }) => {
            const Icon = metric!.icon
            return (
              <div
                key={id}
                className="flex flex-col items-center rounded-xl bg-muted px-4 py-5 text-center"
              >
                <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-background text-foreground">
                  <Icon className="size-5" />
                </div>
                <p className="text-2xl font-bold tracking-tight">{b!.baseline}</p>
                <p className="mt-1 text-sm font-semibold">{metric!.label}</p>
                <p className="mt-2 text-xs leading-snug text-muted-foreground">{b!.note}</p>
              </div>
            )
          })}
        </div>

        {/* Baseline / 9-week / 12-week target table */}
        <div className="self-start overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-semibold">KPI</th>
                <th className="px-4 py-3 font-semibold">Baseline</th>
                <th className="px-4 py-3 font-semibold">9 Weeks</th>
                <th className="px-4 py-3 font-semibold">12 Weeks</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ id, metric, b }) => (
                <tr key={id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{metric!.label}</td>
                  <td className="px-4 py-3 text-muted-foreground">{b!.baseline}</td>
                  <td className="px-4 py-3 text-muted-foreground">{b!.week9}</td>
                  <td className="px-4 py-3 text-muted-foreground">{b!.week12}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
