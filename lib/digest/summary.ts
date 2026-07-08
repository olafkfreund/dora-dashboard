// Pure digest summary builders (text for webhooks, HTML for email). No DB / no React.
import type { ReportData, ReportMetric } from "@/lib/report/report-data"

const GROUPS = ["DORA-4", "Flow", "Velocity & Quality"]
const sevIcon = (s: string) => (s === "high" ? "🔴" : s === "medium" ? "🟠" : "🔵")

function metricLine(m: ReportMetric): string {
  return `${m.label} ${m.value}${m.tier ? ` (${m.tier})` : ""}`
}

/** Plain-text digest — works for Slack / Teams incoming webhooks. */
export function digestText(data: ReportData): string {
  const date = data.generatedAt.toISOString().slice(0, 10)
  const highs = data.attention.filter((a) => a.severity === "high").length
  const lines: string[] = []
  lines.push(`**DORA Dashboard — Delivery Digest**`)
  lines.push(`Team: ${data.teamName ?? "All teams"} · ${date} · window ${data.windowWeeks}w`)
  lines.push(`Live metrics: ${data.liveCount}/${data.totalCount} · High-priority flags: ${highs}`)
  for (const g of GROUPS) {
    const ms = data.metrics.filter((m) => m.group === g && m.live)
    if (ms.length) lines.push(`\n*${g}*: ${ms.map(metricLine).join(" · ")}`)
  }
  if (data.attention.length) {
    lines.push(`\n*Needs attention:*`)
    for (const a of data.attention.slice(0, 6)) lines.push(`${sevIcon(a.severity)} ${a.metric}: ${a.message}`)
  }
  return lines.join("\n")
}

/** HTML digest for email. */
export function digestHtml(data: ReportData): string {
  const date = data.generatedAt.toISOString().slice(0, 10)
  const tierColor = (t: string | null) =>
    t === "Elite" ? "#10b981" : t === "High" ? "#0ea5e9" : t === "Medium" ? "#f59e0b" : t === "Low" ? "#ef4444" : "#6b7280"
  const sevColor = (s: string) => (s === "high" ? "#ef4444" : s === "medium" ? "#f59e0b" : "#6b7280")
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  const groupBlocks = GROUPS.map((g) => {
    const ms = data.metrics.filter((m) => m.group === g && m.live)
    if (!ms.length) return ""
    const rows = ms
      .map(
        (m) =>
          `<tr><td style="padding:4px 8px;">${esc(m.label)}</td><td style="padding:4px 8px;font-weight:600;">${esc(m.value)}</td>` +
          `<td style="padding:4px 8px;">${m.tier ? `<span style="color:#fff;background:${tierColor(m.tier)};border-radius:8px;padding:1px 7px;font-size:11px;">${m.tier}</span>` : ""}</td></tr>`
      )
      .join("")
    return `<h3 style="margin:16px 0 4px;font-size:13px;color:#374151;">${esc(g)}</h3><table style="border-collapse:collapse;font-size:13px;width:100%;">${rows}</table>`
  }).join("")

  const attn = data.attention.length
    ? `<h3 style="margin:18px 0 6px;font-size:13px;color:#374151;">Needs attention</h3>` +
      data.attention
        .slice(0, 8)
        .map(
          (a) =>
            `<div style="margin-bottom:5px;font-size:13px;"><span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${sevColor(a.severity)};margin-right:6px;"></span><b>${esc(a.metric)}:</b> ${esc(a.message)}</div>`
        )
        .join("")
    : ""

  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111827;max-width:640px;">
  <div style="background:#4f46e5;color:#fff;border-radius:8px;padding:16px;">
    <div style="font-size:11px;letter-spacing:1px;color:#c7d2fe;">DORA DASHBOARD</div>
    <div style="font-size:18px;font-weight:700;">Delivery Digest</div>
    <div style="font-size:12px;color:#e0e7ff;margin-top:3px;">Team: ${esc(data.teamName ?? "All teams")} · ${date} · window ${data.windowWeeks}w · ${data.liveCount}/${data.totalCount} live</div>
  </div>
  ${attn}
  ${groupBlocks}
  <p style="font-size:11px;color:#6b7280;margin-top:18px;">DORA Dashboard — confidential delivery metrics. Full report attached (PDF).</p>
</div>`
}
