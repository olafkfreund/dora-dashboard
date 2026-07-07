import { describe, it, expect } from "vitest"
import { computeDoraFromRows, type DeploymentRow } from "./dora-compute"

const NOW = new Date("2026-06-01T12:00:00Z")
const DAY = 864e5
const HOUR = 36e5

function dep(
  projectId: number,
  status: "success" | "failed",
  daysAgo: number,
  committedDaysBefore?: number
): DeploymentRow {
  const finishedAt = new Date(NOW.getTime() - daysAgo * DAY)
  return {
    projectId,
    status,
    finishedAt,
    committedAt:
      committedDaysBefore != null ? new Date(finishedAt.getTime() - committedDaysBefore * DAY) : null,
  }
}

describe("computeDoraFromRows", () => {
  it("returns hasData=false when there are no rows", () => {
    expect(computeDoraFromRows([], NOW).hasData).toBe(false)
  })

  it("computes Deployment Frequency and Change Failure Rate", () => {
    const rows = [
      ...Array.from({ length: 8 }, (_, i) => dep(1, "success", i * 7 + 1)),
      dep(1, "failed", 3),
      dep(1, "failed", 10),
    ]
    const r = computeDoraFromRows(rows, NOW)
    expect(r.hasData).toBe(true)
    expect(r.deploymentFrequency?.value).toBe("1.0/wk") // 8 success / 8 weeks
    // 2 failed of 10 total = 20%
    expect(r.changeFailureRate?.value).toBe("20%")
  })

  it("computes Lead Time as median(finished - committed)", () => {
    const rows = [
      dep(1, "success", 2, 2), // 2-day lead
      dep(1, "success", 9, 2), // 2-day lead
      dep(1, "success", 16, 4), // 4-day lead
    ]
    const r = computeDoraFromRows(rows, NOW)
    // sorted leads [2,2,4] → median 2 days
    expect(r.leadTime?.value).toBe("2.0 days")
  })

  it("computes MTTR as failed→next-success recovery time (hours)", () => {
    // one project: failed, then success 3h later
    const failed = dep(1, "failed", 10)
    const recovered: DeploymentRow = {
      projectId: 1,
      status: "success",
      finishedAt: new Date(failed.finishedAt!.getTime() + 3 * HOUR),
      committedAt: null,
    }
    const r = computeDoraFromRows([failed, recovered], NOW)
    expect(r.mttr?.value).toBe("3.0 hrs")
  })
})
