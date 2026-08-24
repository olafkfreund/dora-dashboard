import { describe, it, expect } from "vitest"
import { effectiveWeeks } from "./config"
import { computeFlow, computeVelocity, type FlowIssueRow, type SprintRow } from "./flow-compute"

const NOW = new Date("2026-06-01T00:00:00Z")
const DAY = 864e5
const WEEK = 7 * DAY
const d = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * DAY)

function issue(p: Partial<FlowIssueRow>): FlowIssueRow {
  return {
    statusCategory: null, storyPoints: null, sprintId: null,
    createdAt: null, inProgressAt: null, resolvedAt: null, blockedSeconds: null,
    ...p,
  }
}

describe("effectiveWeeks", () => {
  it("returns the rolling default when there is no floor", () => {
    expect(effectiveWeeks(8, null, NOW)).toBe(8)
  })
  it("overrides wider when the floor is older than the default window", () => {
    const floor = new Date(NOW.getTime() - 20 * WEEK)
    expect(effectiveWeeks(8, floor, NOW)).toBe(20)
  })
  it("overrides narrower when the floor is more recent than the default window", () => {
    const floor = new Date(NOW.getTime() - 3 * WEEK)
    expect(effectiveWeeks(8, floor, NOW)).toBe(3)
  })
  it("never returns less than one week", () => {
    expect(effectiveWeeks(8, new Date(NOW.getTime() - DAY), NOW)).toBe(1)
  })
})

describe("computeFlow window override", () => {
  // An item resolved 12 weeks ago is outside the default 8-week window but inside a
  // 20-week measure-from window — proving the floor actually pulls in older history.
  const rows = [issue({ statusCategory: "Done", createdAt: d(86), resolvedAt: d(84) })] // ~12 weeks ago, 2d cycle
  it("excludes the old item under the default window", () => {
    expect(computeFlow(rows, NOW).cycleTime).toBeUndefined()
  })
  it("includes it once the window is widened to the floor", () => {
    expect(computeFlow(rows, NOW, [], [], [], 20).cycleTime?.value).toBe("2.0 days")
  })
})

describe("computeVelocity measure-from floor", () => {
  const sprint = (id: number, completeDaysAgo: number): SprintRow => ({
    id, name: `Sprint ${id}`, state: "closed", completeDate: d(completeDaysAgo),
  } as SprintRow)
  const sprints = [sprint(34, 40), sprint(35, 12)]
  const issues = [
    issue({ sprintId: 34, storyPoints: 5, statusCategory: "Done", resolvedAt: d(38) }),
    issue({ sprintId: 35, storyPoints: 8, statusCategory: "Done", resolvedAt: d(10) }),
  ]
  it("counts both sprints with no floor", () => {
    const r = computeVelocity(sprints, issues, 5, null)
    expect(r.averageVelocity?.value).toBe("7 pts") // mean(5,8)=6.5 → 7
  })
  it("drops the pre-floor sprint when measuring from sprint 35's start", () => {
    const floor = d(20) // between sprint 34 (40d) and sprint 35 (12d)
    const r = computeVelocity(sprints, issues, 5, floor)
    expect(r.averageVelocity?.value).toBe("8 pts") // only sprint 35 remains
  })
})
