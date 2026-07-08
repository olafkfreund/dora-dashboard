import { describe, it, expect } from "vitest"
import { renderReportPdf } from "./report-document"
import type { ReportData } from "./report-data"

const data: ReportData = {
  generatedAt: new Date("2026-07-08T09:00:00Z"),
  windowWeeks: 8,
  liveCount: 2,
  totalCount: 14,
  metrics: [
    {
      id: "change-failure-rate", group: "DORA-4", label: "Change Failure Rate", value: "0%", sub: "0/738 failed",
      target: "≤ 15%", unit: "%", source: "GitLab", definition: "d", formula: "f", live: true, tier: "Elite",
      note: "No failed deployments in the window.",
      breakdown: { title: "Deployments by status", columns: ["Status", "8w", "All"], rows: [{ label: "success", values: [738, 988] }] },
    },
    {
      id: "cycle-time", group: "Flow", label: "Cycle Time", value: "3.1 days", sub: "median · 10", target: "< 3d",
      unit: "days", source: "Jira", definition: "d", formula: "f", live: true, tier: null,
      breakdown: { title: "Median time in stage", columns: ["Stage", "Median", "Items"], rows: [{ label: "In QA", values: ["2.0d", 5] }] },
    },
  ],
  attention: [
    { severity: "high", metric: "Lead Time", message: "Low band" },
    { severity: "info", metric: "Change Failure Rate", message: "No failed deployments in the window." },
  ],
}

describe("renderReportPdf", () => {
  it("produces a valid PDF buffer", async () => {
    const buf = await renderReportPdf(data)
    expect(buf.length).toBeGreaterThan(1000)
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-")
  })
})
