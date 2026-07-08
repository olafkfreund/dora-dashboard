import { describe, it, expect } from "vitest"
import { digestText, digestHtml } from "./summary"
import type { ReportData } from "@/lib/report/report-data"

const data: ReportData = {
  generatedAt: new Date("2026-07-08T09:00:00Z"),
  windowWeeks: 8,
  liveCount: 2,
  totalCount: 14,
  teamName: "Platform Squad",
  metrics: [
    { id: "change-failure-rate", group: "DORA-4", label: "Change Failure Rate", value: "0%", sub: "", target: "≤15%", unit: "%", source: "GitLab", definition: "", formula: "", live: true, tier: "Elite" },
    { id: "cycle-time", group: "Flow", label: "Cycle Time", value: "15.2 days", sub: "", target: "<3d", unit: "days", source: "Jira", definition: "", formula: "", live: true, tier: null },
  ],
  attention: [{ severity: "high", metric: "Work Item Age", message: "240 items >14d" }],
}

describe("digest summary", () => {
  it("text summary includes team, live count and attention", () => {
    const t = digestText(data)
    expect(t).toContain("Platform Squad")
    expect(t).toContain("Live metrics: 2/14")
    expect(t).toContain("Change Failure Rate 0% (Elite)")
    expect(t).toContain("Work Item Age: 240 items >14d")
  })

  it("html summary is well-formed and escapes content", () => {
    const h = digestHtml(data)
    expect(h).toContain("Delivery Digest")
    expect(h).toContain("Platform Squad")
    expect(h).toContain("Change Failure Rate")
    expect(h.trimStart().startsWith("<div")).toBe(true)
  })
})
