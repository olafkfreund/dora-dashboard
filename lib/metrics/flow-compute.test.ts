import { describe, it, expect } from "vitest"
import { computeFlow, computeVelocity, type FlowIssueRow, type SprintRow } from "./flow-compute"

const NOW = new Date("2026-06-01T00:00:00Z")
const DAY = 864e5
const d = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * DAY)

function issue(p: Partial<FlowIssueRow>): FlowIssueRow {
  return {
    statusCategory: null, storyPoints: null, sprintId: null,
    createdAt: null, inProgressAt: null, resolvedAt: null, blockedSeconds: null,
    ...p,
  }
}

describe("computeFlow", () => {
  it("hasData=false when empty", () => {
    expect(computeFlow([], NOW).hasData).toBe(false)
  })

  it("cycle time = median(resolved − started)", () => {
    const rows = [
      issue({ statusCategory: "Done", inProgressAt: d(5), resolvedAt: d(3) }), // 2d
      issue({ statusCategory: "Done", inProgressAt: d(10), resolvedAt: d(6) }), // 4d
      issue({ statusCategory: "Done", inProgressAt: d(9), resolvedAt: d(7) }), // 2d
    ]
    expect(computeFlow(rows, NOW).cycleTime?.value).toBe("2.0 days") // median of [2,2,4]
  })

  it("work item age = mean(now − started) for open items", () => {
    const rows = [
      issue({ statusCategory: "In Progress", inProgressAt: d(4) }),
      issue({ statusCategory: "In Progress", inProgressAt: d(6) }),
    ]
    expect(computeFlow(rows, NOW).workItemAge?.value).toBe("5.0 days")
  })

  it("blocked time = blocked / lifetime %", () => {
    // lifetime 10 days, blocked 1 day → 10%
    const rows = [issue({ createdAt: d(10), resolvedAt: NOW, statusCategory: "Done", blockedSeconds: DAY / 1000 })]
    expect(computeFlow(rows, NOW).blockedTime?.value).toBe("10%")
  })

  it("recomputes blocked time from transitions when blocked statuses are configured", () => {
    // Item lifetime 10d. It enters "Defect In Review / Blocked" (a review state we DON'T
    // count) at d8→d6, then real "Blocked" at d4→d2 (2d). With the list = ["Blocked"] only
    // the 2d counts → 2/10 = 20%.
    const rows = [issue({ key: "X-1", createdAt: d(10), resolvedAt: NOW, statusCategory: "Done", blockedSeconds: 9 * DAY / 1000 })]
    const transitions = [
      { issueKey: "X-1", toStatus: "Defect In Review / Blocked", at: d(8) },
      { issueKey: "X-1", toStatus: "In Progress", at: d(6) },
      { issueKey: "X-1", toStatus: "Blocked", at: d(4) },
      { issueKey: "X-1", toStatus: "In Progress", at: d(2) },
    ]
    expect(computeFlow(rows, NOW, transitions, ["Blocked"]).blockedTime?.value).toBe("20%")
  })

  it("work item age counts only currently In-Progress items, minus excluded statuses", () => {
    const rows = [
      issue({ statusCategory: "In Progress", status: "In Dev", inProgressAt: d(10) }), // counts (10d)
      issue({ statusCategory: "To Do", status: "Ready for Dev", inProgressAt: d(100) }), // backlog — excluded
      issue({ statusCategory: "In Progress", status: "Deferred", inProgressAt: d(200) }), // parked — excluded by list
    ]
    // Only the first item (10d) counts → mean 10.0 days.
    expect(computeFlow(rows, NOW, [], [], ["Deferred"]).workItemAge?.value).toBe("10.0 days")
  })

  it("blocked time denominator excludes never-blocked items", () => {
    // Blocked item: lifetime 10d, blocked 2d. A never-blocked item shouldn't dilute it.
    const rows = [
      issue({ createdAt: d(10), resolvedAt: NOW, statusCategory: "Done", blockedSeconds: (2 * DAY) / 1000 }),
      issue({ createdAt: d(10), resolvedAt: NOW, statusCategory: "Done", blockedSeconds: 0 }),
    ]
    // 2d ÷ 10d (only the blocked item's lifetime) = 20%, not 2/20 = 10%
    expect(computeFlow(rows, NOW).blockedTime?.value).toBe("20%")
  })

  it("cycle time includes a time-in-stage breakdown from transitions", () => {
    const rows = [issue({ createdAt: d(10), inProgressAt: d(6), resolvedAt: d(2), statusCategory: "Done" })]
    const transitions = [
      { issueKey: "A-1", toStatus: "In Progress", at: d(6) },
      { issueKey: "A-1", toStatus: "In QA", at: d(4) }, // 2 days In Progress
      { issueKey: "A-1", toStatus: "Done", at: d(2) }, // 2 days In QA; Done terminal → excluded
    ]
    const bd = computeFlow(rows, NOW, transitions).cycleTime?.breakdown
    expect(bd?.title).toMatch(/time in stage/i)
    const stages = Object.fromEntries(bd!.rows.map((r) => [r.label, r.values[0]]))
    expect(stages["In Progress"]).toBe("2.0d")
    expect(stages["In QA"]).toBe("2.0d")
    expect(stages["Done"]).toBeUndefined()
  })

  it("work item age has age buckets (0-3 / 3-7 / 7-14 / 14d+)", () => {
    const open = (daysAgo: number) => issue({ statusCategory: "In Progress", inProgressAt: d(daysAgo), createdAt: d(daysAgo) })
    const bd = computeFlow([open(1), open(5), open(20)], NOW).workItemAge?.breakdown
    expect(bd!.rows[0].values[0]).toBe(1) // 0-3d
    expect(bd!.rows[1].values[0]).toBe(1) // 3-7d
    expect(bd!.rows[2].values[0]).toBe(0) // 7-14d
    expect(bd!.rows[3].values[0]).toBe(1) // 14d+
  })
})

describe("computeVelocity", () => {
  it("hasData=false with no closed sprints", () => {
    expect(computeVelocity([], []).hasData).toBe(false)
  })

  it("average velocity + predictability over closed sprints", () => {
    const sprints: SprintRow[] = [
      { id: 1, name: "Sprint 1", state: "closed", startDate: d(28), completeDate: d(14) },
      { id: 2, name: "Sprint 2", state: "closed", startDate: d(14), completeDate: d(1) },
    ]
    const issues = [
      // sprint 1: committed 10, completed 8
      issue({ sprintId: 1, storyPoints: 8, statusCategory: "Done" }),
      issue({ sprintId: 1, storyPoints: 2, statusCategory: "In Progress" }),
      // sprint 2: committed 10, completed 10
      issue({ sprintId: 2, storyPoints: 10, statusCategory: "Done" }),
    ]
    const r = computeVelocity(sprints, issues)
    expect(r.averageVelocity?.value).toBe("9 pts") // mean(8,10)
    expect(r.deliveryPredictability?.value).toBe("90%") // mean(80%,100%)
  })

  it("explains a 0 velocity when the closed sprint has no story-pointed issues", () => {
    const sprints: SprintRow[] = [{ id: 1, name: "Sprint 1", state: "closed", startDate: new Date(), completeDate: new Date() }]
    const issues: FlowIssueRow[] = [
      { statusCategory: "In Progress", storyPoints: null, sprintId: 1, createdAt: new Date(), inProgressAt: new Date(), resolvedAt: null, blockedSeconds: 0 },
    ]
    const r = computeVelocity(sprints, issues)
    expect(r.averageVelocity?.value).toBe("0 pts")
    expect(r.averageVelocity?.note).toMatch(/no story-pointed issues/i)
  })
})
