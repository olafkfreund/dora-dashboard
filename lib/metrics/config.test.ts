import { describe, it, expect } from "vitest"
import { DEFAULT_CONFIG, mergeConfig, parseConfig } from "./config"

describe("metric config", () => {
  it("empty/missing config yields defaults (today's behavior)", () => {
    expect(parseConfig(null)).toEqual(DEFAULT_CONFIG)
    expect(parseConfig(undefined)).toEqual(DEFAULT_CONFIG)
    expect(parseConfig({})).toEqual(DEFAULT_CONFIG)
  })

  it("default deployment filter matches all environments (no behavior change)", () => {
    // Empty allowlist + null ref = match every ingested deployment, exactly as today.
    expect(DEFAULT_CONFIG.deployment.environments).toEqual([])
    expect(DEFAULT_CONFIG.deployment.refPattern).toBeNull()
    expect(DEFAULT_CONFIG.deployment.failureStatuses).toEqual(["failed"])
  })

  it("deep-merges a partial deployment over defaults", () => {
    const c = parseConfig({ deployment: { environments: ["production"] } })
    expect(c.deployment.environments).toEqual(["production"])
    expect(c.deployment.failureStatuses).toEqual(["failed"]) // preserved
  })

  it("merges a single band threshold, keeping the others", () => {
    const c = parseConfig({ bands: { "change-failure-rate": { elite: 10 } } })
    expect(c.bands["change-failure-rate"]).toEqual({ elite: 10, high: 30, medium: 45 })
    expect(c.bands["mttr"]).toEqual(DEFAULT_CONFIG.bands["mttr"]) // untouched
  })

  it("overrides window and targets", () => {
    const c = parseConfig({ windowWeeks: 12, targets: { "cycle-time": 2 } })
    expect(c.windowWeeks).toBe(12)
    expect(c.targets["cycle-time"]).toBe(2)
  })

  it("mergeConfig on empty input equals DEFAULT_CONFIG", () => {
    expect(mergeConfig({})).toEqual(DEFAULT_CONFIG)
  })

  it("falls back to defaults on invalid input", () => {
    expect(parseConfig({ windowWeeks: -5 })).toEqual(DEFAULT_CONFIG)
    expect(parseConfig("garbage")).toEqual(DEFAULT_CONFIG)
  })
})
