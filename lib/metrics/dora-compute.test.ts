import { describe, it, expect } from "vitest"
import { computeDoraFromRows, computeIncidentMttr, type DeploymentRow } from "./dora-compute"

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

  it("Lead Time prefers the MR's first commit when deploy sha matches the MR merge sha", () => {
    // deploy of merge commit "abc", finished 5 days after; committedAt is deploy-time (0d).
    const dep: DeploymentRow = {
      projectId: 1,
      status: "success",
      finishedAt: new Date(NOW.getTime() - 1 * DAY),
      committedAt: new Date(NOW.getTime() - 1.5 * DAY), // deploy-commit method: 0.5 day = 12 hrs
      sha: "abc",
    }
    const mrs = [{ mergeCommitSha: "abc", firstCommitAt: new Date(NOW.getTime() - 6 * DAY) }] // 5-day feature
    const r = computeDoraFromRows([dep], NOW, { mrs, leadTimeMode: "mr" })
    expect(r.leadTime?.value).toBe("5.0 days")
    // gitops mode ignores the MR → falls back to the deployed-commit date
    const g = computeDoraFromRows([dep], NOW, { mrs, leadTimeMode: "gitops" })
    expect(g.leadTime?.value).toBe("12.0 hrs")
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

describe("computeDoraFromRows — configurable definition", () => {
  const at = (daysAgo: number): Date => new Date(NOW.getTime() - daysAgo * DAY)
  const DEF = { environments: [] as string[], refPattern: null as string | null, failureStatuses: ["failed"] }

  it("environment allowlist excludes deploys from other environments", () => {
    const rows: DeploymentRow[] = [
      { projectId: 1, status: "success", finishedAt: at(1), committedAt: null, environment: "production" },
      { projectId: 1, status: "success", finishedAt: at(2), committedAt: null, environment: "staging" },
    ]
    expect(computeDoraFromRows(rows, NOW).deploymentsTotal).toBe(2) // default: match all
    const prod = computeDoraFromRows(rows, NOW, { deployment: { ...DEF, environments: ["production"] } })
    expect(prod.deploymentsTotal).toBe(1)
  })

  it("refPattern filters deploys by branch/ref", () => {
    const rows: DeploymentRow[] = [
      { projectId: 1, status: "success", finishedAt: at(1), committedAt: null, ref: "main" },
      { projectId: 1, status: "success", finishedAt: at(2), committedAt: null, ref: "feature/x" },
    ]
    const r = computeDoraFromRows(rows, NOW, { deployment: { ...DEF, refPattern: "^main$" } })
    expect(r.deploymentsTotal).toBe(1)
  })

  it("counts a configured custom status as a change failure", () => {
    const rows: DeploymentRow[] = [
      { projectId: 1, status: "success", finishedAt: at(1), committedAt: null },
      { projectId: 1, status: "canceled", finishedAt: at(2), committedAt: null },
    ]
    // default: "canceled" is not a failure → 0%
    expect(computeDoraFromRows(rows, NOW).changeFailureRate?.value).toBe("0%")
    const r = computeDoraFromRows(rows, NOW, { deployment: { ...DEF, failureStatuses: ["failed", "canceled"] } })
    expect(r.changeFailureRate?.value).toBe("50%") // 1 of 2
  })

  it("windowWeeks changes the frequency denominator", () => {
    const rows = Array.from({ length: 4 }, (_, i) => dep(1, "success", i * 7 + 1)) // days 1,8,15,22
    expect(computeDoraFromRows(rows, NOW).deploymentFrequency?.value).toBe("0.5/wk") // 4/8
    const r = computeDoraFromRows(rows, NOW, { windowWeeks: 4 })
    expect(r.deploymentFrequency?.value).toBe("1.0/wk") // 4/4
    expect(r.windowWeeks).toBe(4)
  })

  it("an invalid refPattern is ignored (no crash, matches all)", () => {
    const rows: DeploymentRow[] = [{ projectId: 1, status: "success", finishedAt: at(1), committedAt: null, ref: "main" }]
    const r = computeDoraFromRows(rows, NOW, { deployment: { ...DEF, refPattern: "([" } })
    expect(r.deploymentsTotal).toBe(1)
  })

  it("computeIncidentMttr = median(closed − created) for in-window incidents", () => {
    const at = (d: number) => new Date(NOW.getTime() - d * DAY)
    const incidents = [
      { createdAt: at(2), closedAt: new Date(at(2).getTime() + 2 * HOUR) }, // 2h
      { createdAt: at(5), closedAt: new Date(at(5).getTime() + 4 * HOUR) }, // 4h
      { createdAt: at(400), closedAt: at(399) }, // closed before the window → excluded
      { createdAt: at(3), closedAt: null }, // still open → excluded
    ]
    const m = computeIncidentMttr(incidents, NOW)
    expect(m?.value).toBe("3.0 hrs") // median(2h, 4h)
    expect(m?.sub).toMatch(/2 incidents/)
  })

  it("computeIncidentMttr is undefined with no closed incidents in window", () => {
    expect(computeIncidentMttr([{ createdAt: NOW, closedAt: null }], NOW)).toBeUndefined()
  })

  it("statusBreakdown splits counts by status (window vs all-time)", () => {
    const rows: DeploymentRow[] = [
      { projectId: 1, status: "success", finishedAt: at(1), committedAt: null },
      { projectId: 1, status: "success", finishedAt: at(2), committedAt: null },
      { projectId: 1, status: "skipped", finishedAt: at(3), committedAt: null },
      { projectId: 1, status: "failed", finishedAt: at(400), committedAt: null }, // outside 8w window
    ]
    const bd = computeDoraFromRows(rows, NOW).statusBreakdown!
    const byStatus = Object.fromEntries(bd.map((s) => [s.status, s]))
    expect(byStatus.success).toEqual({ status: "success", inWindow: 2, total: 2 })
    expect(byStatus.skipped).toEqual({ status: "skipped", inWindow: 1, total: 1 })
    // the failed deploy is older than the window: counted in total, not in window
    expect(byStatus.failed).toEqual({ status: "failed", inWindow: 0, total: 1 })
  })
})
