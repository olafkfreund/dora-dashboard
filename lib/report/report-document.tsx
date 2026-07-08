import { createElement } from "react"
import { Document, Page, Text, View, StyleSheet, Svg, Rect, Path, Circle, Line, renderToBuffer } from "@react-pdf/renderer"
import type { ReportData, ReportMetric, Attention } from "./report-data"

const C = {
  ink: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
  card: "#f9fafb",
  primary: "#4f46e5",
  elite: "#10b981",
  high: "#0ea5e9",
  medium: "#f59e0b",
  low: "#ef4444",
  white: "#ffffff",
}
const tierColor = (t: string | null) =>
  t === "Elite" ? C.elite : t === "High" ? C.high : t === "Medium" ? C.medium : t === "Low" ? C.low : C.muted
const sevColor = (s: Attention["severity"]) => (s === "high" ? C.low : s === "medium" ? C.medium : C.muted)

const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 46, paddingHorizontal: 34, fontSize: 9, color: C.ink, fontFamily: "Helvetica" },
  band: { backgroundColor: C.primary, borderRadius: 6, padding: 14, marginBottom: 14 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  eyebrow: { color: "#c7d2fe", fontSize: 7, letterSpacing: 1.5, fontFamily: "Helvetica-Bold", marginBottom: 1 },
  h1: { color: C.white, fontSize: 18, fontFamily: "Helvetica-Bold" },
  bandSub: { color: "#e0e7ff", fontSize: 9, marginTop: 3 },
  statRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  stat: { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 4, padding: 6, flexGrow: 1 },
  statVal: { color: C.white, fontSize: 13, fontFamily: "Helvetica-Bold" },
  statLbl: { color: "#e0e7ff", fontSize: 7 },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 6, color: C.ink },
  groupTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginTop: 10, marginBottom: 4 },
  card: { borderWidth: 1, borderColor: C.border, borderRadius: 5, padding: 9, marginBottom: 7, backgroundColor: C.white },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardLabel: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  cardValueRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardValue: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  chip: { color: C.white, fontSize: 7, fontFamily: "Helvetica-Bold", paddingVertical: 2, paddingHorizontal: 5, borderRadius: 8 },
  meta: { color: C.muted, fontSize: 8, marginTop: 3 },
  note: { backgroundColor: "#fffbeb", borderColor: "#fcd34d", borderWidth: 1, borderRadius: 4, padding: 6, marginTop: 5, fontSize: 8, color: "#92400e" },
  table: { marginTop: 6, borderWidth: 1, borderColor: C.border, borderRadius: 4 },
  th: { flexDirection: "row", backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.border },
  cellL: { flexGrow: 1, padding: 4, fontSize: 8 },
  cellR: { width: 74, padding: 4, fontSize: 8, textAlign: "right", color: C.muted },
  thText: { fontFamily: "Helvetica-Bold", fontSize: 7.5 },
  attn: { flexDirection: "row", gap: 6, marginBottom: 4, alignItems: "flex-start" },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 2 },
  attnText: { fontSize: 8, flexGrow: 1, flexBasis: 0 },
  footer: { position: "absolute", bottom: 20, left: 34, right: 34, flexDirection: "row", justifyContent: "space-between", color: C.muted, fontSize: 7, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 5 },
})

/** Brand mark: a white rounded square with a gauge glyph (matches the app's Gauge logo). */
function LogoMark() {
  return createElement(
    Svg,
    { width: 30, height: 30 },
    createElement(Rect, { x: 0, y: 0, width: 30, height: 30, rx: 7, fill: C.white }),
    createElement(Path, { d: "M7 20 A 8 8 0 0 1 23 20", stroke: C.primary, strokeWidth: 2.4, fill: "none" }),
    createElement(Line, { x1: 15, y1: 20, x2: 20, y2: 12, stroke: C.primary, strokeWidth: 2.2 }),
    createElement(Circle, { cx: 15, cy: 20, r: 2, fill: C.primary })
  )
}

function BreakdownTable({ b }: { b: NonNullable<ReportMetric["breakdown"]> }) {
  return createElement(
    View,
    { style: s.table, wrap: false },
    createElement(
      View,
      { style: s.th },
      ...b.columns.map((c, i) =>
        createElement(
          View,
          { key: i, style: i === 0 ? s.cellL : s.cellR },
          createElement(Text, { style: s.thText }, c)
        )
      )
    ),
    ...b.rows.slice(0, 16).map((r, ri) =>
      createElement(
        View,
        { key: ri, style: s.tr },
        createElement(View, { style: s.cellL }, createElement(Text, {}, r.label)),
        ...r.values.map((v, vi) => createElement(View, { key: vi, style: s.cellR }, createElement(Text, {}, String(v))))
      )
    )
  )
}

function MetricCard({ m }: { m: ReportMetric }) {
  const children: React.ReactNode[] = [
    createElement(
      View,
      { key: "top", style: s.cardTop },
      createElement(Text, { style: s.cardLabel }, m.label),
      createElement(
        View,
        { style: s.cardValueRow },
        m.tier
          ? createElement(Text, { style: [s.chip, { backgroundColor: tierColor(m.tier) }] }, m.tier)
          : null,
        createElement(Text, { style: [s.cardValue, { color: tierColor(m.tier) }] }, m.value)
      )
    ),
    createElement(Text, { key: "meta", style: s.meta }, `${m.sub}  ·  target ${m.target}  ·  ${m.live ? "live" : "sample"} · ${m.source}`),
  ]
  if (m.note) children.push(createElement(Text, { key: "note", style: s.note }, `Why: ${m.note}`))
  if (m.breakdown) children.push(createElement(BreakdownTable, { key: "bd", b: m.breakdown }))
  return createElement(View, { style: s.card, wrap: false }, ...children)
}

const GROUPS = ["DORA-4", "Flow", "Velocity & Quality"]

function ReportDocument({ data }: { data: ReportData }) {
  const attn = data.attention.slice(0, 12)
  return createElement(
    Document,
    { title: "DORA Dashboard — Delivery Report" },
    createElement(
      Page,
      { size: "A4", style: s.page },
      // Header band
      createElement(
        View,
        { style: s.band },
        createElement(
          View,
          { style: s.brandRow },
          createElement(LogoMark, {}),
          createElement(
            View,
            {},
            createElement(Text, { style: s.eyebrow }, "DORA DASHBOARD"),
            createElement(Text, { style: s.h1 }, "Delivery Performance Report")
          )
        ),
        createElement(
          Text,
          { style: s.bandSub },
          `Team: ${data.teamName ?? "All teams"}  ·  generated ${data.generatedAt.toISOString().replace("T", " ").slice(0, 16)} UTC  ·  window ${data.windowWeeks}w`
        ),
        createElement(
          View,
          { style: s.statRow },
          createElement(
            View,
            { style: s.stat },
            createElement(Text, { style: s.statVal }, `${data.liveCount}/${data.totalCount}`),
            createElement(Text, { style: s.statLbl }, "LIVE METRICS")
          ),
          createElement(
            View,
            { style: s.stat },
            createElement(Text, { style: s.statVal }, String(data.attention.filter((a) => a.severity === "high").length)),
            createElement(Text, { style: s.statLbl }, "HIGH-PRIORITY FLAGS")
          ),
          createElement(
            View,
            { style: s.stat },
            createElement(Text, { style: s.statVal }, String(data.metrics.filter((m) => m.tier === "Elite").length)),
            createElement(Text, { style: s.statLbl }, "ELITE-TIER METRICS")
          )
        )
      ),
      // Needs attention
      attn.length
        ? createElement(
            View,
            { wrap: false },
            createElement(Text, { style: s.sectionTitle }, "Needs attention"),
            ...attn.map((a, i) =>
              createElement(
                View,
                { key: i, style: s.attn },
                createElement(View, { style: [s.dot, { backgroundColor: sevColor(a.severity) }] }),
                createElement(Text, { style: s.attnText }, `${a.metric}: ${a.message}`)
              )
            )
          )
        : null,
      // Metric groups
      ...GROUPS.map((g) =>
        createElement(
          View,
          { key: g },
          createElement(Text, { style: s.groupTitle }, g),
          ...data.metrics.filter((m) => m.group === g).map((m) => createElement(MetricCard, { key: m.id, m }))
        )
      ),
      createElement(
        View,
        { style: s.footer, fixed: true },
        createElement(Text, {}, "DORA Dashboard — confidential delivery metrics"),
        createElement(Text, { render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `${pageNumber} / ${totalPages}` })
      )
    )
  )
}

/** Render the delivery report to a PDF buffer. */
export async function renderReportPdf(data: ReportData): Promise<Buffer> {
  // Call the function so the top-level element is the <Document> react-pdf expects.
  return renderToBuffer(ReportDocument({ data }))
}
