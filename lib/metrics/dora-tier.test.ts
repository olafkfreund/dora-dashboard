import { describe, it, expect } from "vitest"
import { classifyTier } from "./dora-tier"

describe("classifyTier", () => {
  it("Deployment Frequency (higher better)", () => {
    expect(classifyTier("deployment-frequency", "14.2/wk")?.tier).toBe("Elite")
    expect(classifyTier("deployment-frequency", "3/wk")?.tier).toBe("High")
    expect(classifyTier("deployment-frequency", "0.5/wk")?.tier).toBe("Medium")
    expect(classifyTier("deployment-frequency", "0.1/wk")?.tier).toBe("Low")
  })

  it("Lead Time (lower better, unit-aware)", () => {
    expect(classifyTier("lead-time-for-changes", "2.3 hrs")?.tier).toBe("Elite")
    expect(classifyTier("lead-time-for-changes", "1.8 days")?.tier).toBe("High")
    expect(classifyTier("lead-time-for-changes", "10 days")?.tier).toBe("Medium")
    expect(classifyTier("lead-time-for-changes", "40 days")?.tier).toBe("Low")
  })

  it("Change Failure Rate", () => {
    expect(classifyTier("change-failure-rate", "9.4%")?.tier).toBe("Elite")
    expect(classifyTier("change-failure-rate", "20%")?.tier).toBe("High")
    expect(classifyTier("change-failure-rate", "60%")?.tier).toBe("Low")
  })

  it("MTTR (unit-aware)", () => {
    expect(classifyTier("mttr", "0.5 hrs")?.tier).toBe("Elite")
    expect(classifyTier("mttr", "2.3 hrs")?.tier).toBe("High")
    expect(classifyTier("mttr", "3 days")?.tier).toBe("Medium") // 72h ≤ 168
    expect(classifyTier("mttr", "10 days")?.tier).toBe("Low") // 240h > 168
  })

  it("returns null for non-DORA metrics", () => {
    expect(classifyTier("cycle-time", "3.1 days")).toBeNull()
    expect(classifyTier("average-velocity", "42 pts")).toBeNull()
  })
})
