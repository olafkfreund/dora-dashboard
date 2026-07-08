import { auth } from "@/auth"
import { buildReport } from "@/lib/report/report-data"
import { resolveTeamFilter } from "@/lib/teams/store"

export const runtime = "nodejs"

// CSV delivery report — all metrics + their drill-down breakdowns.
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } })
  }

  const filter = await resolveTeamFilter(new URL(req.url).searchParams.get("team"))
  const report = await buildReport(new Date(), filter)
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`
  const lines: string[] = []

  lines.push(`"DORA Dashboard — delivery report"`)
  lines.push(`"Team","${report.teamName ?? "All teams"}"`)
  lines.push(`"Generated","${report.generatedAt.toISOString()}"`)
  lines.push(`"Rolling window","${report.windowWeeks} weeks"`)
  lines.push(`"Live metrics","${report.liveCount}/${report.totalCount}"`)
  lines.push("")

  lines.push(["section", "metric", "value", "target", "tier", "source", "state", "detail", "note"].map(esc).join(","))
  for (const m of report.metrics) {
    lines.push(
      [m.group, m.label, m.value, m.target, m.tier ?? "", m.source, m.live ? "live" : "sample", m.sub, m.note ?? ""]
        .map(esc)
        .join(",")
    )
  }

  // Needs-attention section.
  if (report.attention.length) {
    lines.push("")
    lines.push(`"Needs attention"`)
    lines.push(["severity", "metric", "message"].map(esc).join(","))
    for (const a of report.attention) lines.push([a.severity, a.metric, a.message].map(esc).join(","))
  }

  // Drill-down breakdown tables.
  for (const m of report.metrics) {
    if (!m.breakdown) continue
    lines.push("")
    lines.push(esc(`${m.label} — ${m.breakdown.title}`))
    lines.push(m.breakdown.columns.map(esc).join(","))
    for (const r of m.breakdown.rows) lines.push([r.label, ...r.values].map(esc).join(","))
  }

  const csv = lines.join("\r\n")
  const stamp = report.generatedAt.toISOString().slice(0, 10)
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dora-report-${stamp}.csv"`,
    },
  })
}
