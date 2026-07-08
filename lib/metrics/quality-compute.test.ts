import { describe, it, expect } from "vitest"
import { computeQuality, computeCoverage, type QualityIssueRow } from "./quality-compute"

const iss = (issueType: string | null, labels: string[] | null): QualityIssueRow => ({ issueType, labels })

describe("computeQuality", () => {
  it("hasData=false with no defects", () => {
    expect(computeQuality([iss("Story", [])]).hasData).toBe(false)
  })

  it("escape rate + root cause from labels", () => {
    const rows = [
      iss("Bug", ["production"]), // escaped
      iss("Bug", ["requirements"]), // upstream
      iss("Bug", []),
      iss("Bug", ["design"]), // upstream
      iss("Story", ["production"]), // not a defect — ignored
    ]
    const r = computeQuality(rows)
    // 4 defects, 1 escaped → 25%
    expect(r.defectEscapeRate?.value).toBe("25%")
    // 2 upstream (requirements, design) of 4 → 50%
    expect(r.defectRootCause?.value).toBe("50%")
  })

  it("explains a 0% root cause when no defect carries a root-cause label", () => {
    const rows = [
      { issueType: "Bug", labels: ["QA", "BackEnd"] },
      { issueType: "Bug", labels: ["Claims"] },
    ]
    const r = computeQuality(rows)
    expect(r.defectRootCause?.value).toBe("0%")
    expect(r.defectRootCause?.note).toMatch(/tag defects/i)
  })

  it("uses the Root Cause Analysis + Environment Type fields when populated", () => {
    const rows = [
      { issueType: "Bug", labels: null, rootCause: "Requirement - Ambiguous / Incomplete", defectEnv: "Production Env" },
      { issueType: "Bug", labels: null, rootCause: "Design - Changed", defectEnv: "Non-Prod Env" },
      { issueType: "Bug", labels: null, rootCause: "Code Defect - UI", defectEnv: "Pre-Prod Env" },
      { issueType: "Bug", labels: null, rootCause: "Under Review", defectEnv: "Non-Prod Env" },
    ]
    const r = computeQuality(rows)
    // upstream (requirements+design) = 2 of 3 triaged (Under Review excluded) → 66.7%
    expect(r.defectRootCause?.value).toBe("66.7%")
    // 1 of 4 defects is in Production → 25%
    expect(r.defectEscapeRate?.value).toBe("25%")
  })
})

describe("computeCoverage", () => {
  it("hasData=false with no coverage", () => {
    expect(computeCoverage([{ coverage: null }, { coverage: null }]).hasData).toBe(false)
  })
  it("mean of available coverage", () => {
    const r = computeCoverage([{ coverage: 80 }, { coverage: 70 }, { coverage: null }])
    expect(r.testAutomationCoverage?.value).toBe("75%") // mean(80,70)
  })
})
