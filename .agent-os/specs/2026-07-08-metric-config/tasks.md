# Spec Tasks

These are the tasks for the spec in @.agent-os/specs/2026-07-08-metric-config/spec.md

> Created: 2026-07-08
> Status: Ready for Implementation
> Issue: #19

## Tasks

- [ ] 1. Schema + config layer (`S`)
  - [ ] 1.1 Write tests for `getMetricConfig` (missing row → defaults; partial → deep-merge)
  - [ ] 1.2 Add `metricConfig` table to `db/schema.ts`
  - [ ] 1.3 `drizzle-kit generate` → committed migration `0011`
  - [ ] 1.4 `lib/metrics/config.ts`: `MetricConfig` type, Zod schema, `getMetricConfig()` with default merge
  - [ ] 1.5 Verify tests pass

- [ ] 2. Wire config into compute (`M`)
  - [ ] 2.1 Write tests: env allowlist excludes non-prod deploys; custom bands reclassify; window override
  - [ ] 2.2 `dora-compute.ts`: apply deployment filters (env/ref/failureStatuses) + `windowWeeks` via `DoraOpts`
  - [ ] 2.3 `dora-tier.ts`: `classifyTier(metricId, value, bands?)` with defaults unchanged
  - [ ] 2.4 `dora.ts`: load `metric_config`, pass filters/window/bands down
  - [ ] 2.5 `flow-compute` / `quality-compute` / velocity: read configurable `targets`
  - [ ] 2.6 Verify all existing + new tests green

- [ ] 3. Settings UI (`M`)
  - [ ] 3.1 `metric-config-actions.ts` server action (`requireAdmin`, Zod-validated, audited)
  - [ ] 3.2 `app/settings/metrics-panel.tsx` (mirror integrations-panel)
  - [ ] 3.3 Add "Metric definitions" section to `settings/page.tsx` + "Reset to DORA defaults"
  - [ ] 3.4 Verify: admin edit recomputes dashboard; non-admin blocked; audit row written

- [ ] 4. Lineage in detail view (`S`)
  - [ ] 4.1 Extend `metric-dialog.tsx` to show active rules (env allowlist, window, band thresholds, lead-time mode)
  - [ ] 4.2 Verify a DORA card shows live definition, not just static formula

- [ ] 5. Docs + ship (`XS`)
  - [ ] 5.1 "Configuring metric definitions" section in `docs/metrics.md`
  - [ ] 5.2 Zero-downtime deploy (build → GHCR → helm upgrade --set image.tag → resync)
  - [ ] 5.3 Close #19; open follow-on "per-team targets/bands" issue

## Follow-on (out of this spec)

- New issue: **Per-team targets & benchmark bands** — depends on a `teams` model + team
  assignment for GitLab projects / Jira boards + team filtering across compute.
