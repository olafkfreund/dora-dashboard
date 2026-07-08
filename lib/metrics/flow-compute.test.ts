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
})

describe("computeVelocity", () => {
  it("hasData=false with no closed sprints", () => {
    expect(computeVelocity([], []).hasData).toBe(false)
  })

  it("average velocity + predictability over closed sprints", () => {
    const sprints: SprintRow[] = [
      { id: 1, state: "closed", startDate: d(28), completeDate: d(14) },
      { id: 2, state: "closed", startDate: d(14), completeDate: d(1) },
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
    const sprints: SprintRow[] = [{ id: 1, state: "closed", startDate: new Date(), completeDate: new Date() }]
    const issues: FlowIssueRow[] = [
      { statusCategory: "In Progress", storyPoints: null, sprintId: 1, createdAt: new Date(), inProgressAt: new Date(), resolvedAt: null, blockedSeconds: 0 },
    ]
    const r = computeVelocity(sprints, issues)
    expect(r.averageVelocity?.value).toBe("0 pts")
    expect(r.averageVelocity?.note).toMatch(/no story-pointed issues/i)
  })
})
