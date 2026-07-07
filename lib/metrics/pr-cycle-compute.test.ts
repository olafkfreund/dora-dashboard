import { describe, it, expect } from "vitest"
import { computePrCycle, type PrMrRow } from "./pr-cycle-compute"

const NOW = new Date("2026-06-01T00:00:00Z")
const DAY = 864e5
const ago = (d: number) => new Date(NOW.getTime() - d * DAY)

describe("computePrCycle", () => {
  it("hasData=false with no merged MRs", () => {
    expect(computePrCycle([], new Map(), NOW).hasData).toBe(false)
  })

  it("breaks a merged MR into stages", () => {
    // first commit 5d ago, opened 4d ago, first review 3d ago, merged 2d ago; deployed 1d ago
    const mr: PrMrRow = {
      firstCommitAt: ago(5),
      createdAt: ago(4),
      firstReviewAt: ago(3),
      mergedAt: ago(2),
      mergeCommitSha: "abc",
    }
    const deployBySha = new Map<string, Date>([["abc", ago(1)]])
    const r = computePrCycle([mr], deployBySha, NOW)
    expect(r.hasData).toBe(true)
    // total: first commit (5d) → merged (2d) = 3 days
    expect(r.prCycleTime?.value).toBe("3.0 days")
    // each stage is 1 day; deploy stage present
    expect(r.prCycleTime?.sub).toBe("Code 1.0d · Pickup 1.0d · Review 1.0d · Deploy 1.0d")
  })

  it("skips stages without data (no review)", () => {
    const mr: PrMrRow = { firstCommitAt: ago(3), createdAt: ago(2), firstReviewAt: null, mergedAt: ago(1), mergeCommitSha: null }
    const r = computePrCycle([mr], new Map(), NOW)
    expect(r.prCycleTime?.sub).toBe("Code 1.0d")
  })
})
