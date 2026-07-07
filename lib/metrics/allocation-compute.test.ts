import { describe, it, expect } from "vitest"
import { computeAllocation, categorize, type AllocIssueRow } from "./allocation-compute"

const iss = (p: Partial<AllocIssueRow>): AllocIssueRow => ({ issueType: null, labels: null, storyPoints: null, ...p })

describe("categorize", () => {
  it("classifies by type + labels (debt > support > ktlo > feature)", () => {
    expect(categorize(iss({ issueType: "Story" }))).toBe("feature")
    expect(categorize(iss({ labels: ["tech-debt"] }))).toBe("debt")
    expect(categorize(iss({ issueType: "Incident" }))).toBe("support")
    expect(categorize(iss({ labels: ["maintenance"] }))).toBe("ktlo")
    expect(categorize(iss({ issueType: "Story", labels: ["refactor"] }))).toBe("debt") // debt wins
  })
})

describe("computeAllocation", () => {
  it("hasData=false when empty", () => {
    expect(computeAllocation([]).hasData).toBe(false)
  })
  it("weights by story points and reports percentages", () => {
    const rows = [
      iss({ issueType: "Story", storyPoints: 6 }), // feature 6
      iss({ labels: ["tech-debt"], storyPoints: 2 }), // debt 2
      iss({ issueType: "Incident", storyPoints: 1 }), // support 1
      iss({ labels: ["ktlo"], storyPoints: 1 }), // ktlo 1
    ]
    const r = computeAllocation(rows)
    expect(r.investmentAllocation?.value).toBe("60% feature")
    expect(r.investmentAllocation?.sub).toBe("KTLO 10% · Debt 20% · Support 10%")
  })
})
