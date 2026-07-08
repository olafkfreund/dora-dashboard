import { auth } from "@/auth"
import { buildReport } from "@/lib/report/report-data"
import { renderReportPdf } from "@/lib/report/report-document"

export const runtime = "nodejs"

// Branded PDF delivery report (colored metric cards, breakdowns, needs-attention).
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } })
  }

  const report = await buildReport()
  const pdf = await renderReportPdf(report)
  const stamp = report.generatedAt.toISOString().slice(0, 10)
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="dora-report-${stamp}.pdf"`,
    },
  })
}
