# Spec Requirements Document

> Spec: Configurable metric definitions, targets & benchmark bands
> Created: 2026-07-08
> Status: Planning
> Issue: #19

## Overview

Make the top source of "these numbers are wrong" disputes configurable and auditable:
what counts as a deployment / change failure, the rolling window, per-metric targets, and
the Elite/High/Medium/Low benchmark bands. Scope is **org-level (global) config**; per-team
scoping is deferred to a follow-on that first needs a teams model.

## User Stories

### Admin defines what a deployment is
As an **Admin**, I want to declare which environments/branches count as a production
deployment and which statuses count as a change failure, so that DORA-4 reflects our
actual pipeline instead of every environment.

### Lead sets targets and bands
As a **Lead**, I want per-metric targets and benchmark bands, so the dashboard's
healthy/watch signals and Elite/High/Medium/Low tiers match our goals.

### Auditor sees lineage
As an **Auditor/Viewer**, I want each metric's detail view to show the active rules
(env allowlist, window, band thresholds) behind the number, so the figure is defensible.

## Spec Scope

1. **`metric_config` table** - single-row, org-global, audited jsonb config with defaults that reproduce today's behavior.
2. **Config layer** - `lib/metrics/config.ts`: typed getter, Zod validation, deep-merge over hardcoded defaults.
3. **Deployment/failure definition** - compute-time filter on `gitlab_deployment` (environment allowlist, ref pattern, failure statuses). No re-ingest (env/ref/status already stored).
4. **Configurable window & bands** - `windowWeeks` + per-DORA-metric bands feed `dora-compute` and `classifyTier(metricId, value, bands?)`.
5. **Configurable targets** - per-metric target drives healthy/watch and card target text (flow/quality/velocity).
6. **Settings UI** - admin-only "Metric definitions" panel (server action, Zod-validated, audited) with "Reset to DORA defaults".
7. **Lineage in detail view** - metric dialog shows the active rules alongside the formula.
8. **Docs** - "Configuring metric definitions" section in `docs/metrics.md`.

## Out of Scope

- **Per-team** targets/bands and team-scoped filtering (no teams model exists) → follow-on issue.
- Incident-based change-failure/MTTR ingestion → tracked in #41 (this spec only makes the *rule selection* configurable).

## Expected Deliverable

1. An admin can set env allowlist / ref pattern / failure statuses / window / bands / targets in Settings; changes are audited and immediately reflected in computed metrics.
2. An empty/missing config yields exactly today's numbers (safe default).
3. Each metric detail view surfaces the active definition + lineage.
4. Shipped via zero-downtime deploy; #19 closed.

## Design Notes

**`metric_config.config` jsonb:**
```jsonc
{
  "deployment": {
    "environments": ["production"],
    "refPattern": "^(main|release/.*)$",
    "failureStatuses": ["failed"]
  },
  "windowWeeks": 8,
  "bands": {
    "deployment-frequency": { "elite": 7, "high": 1, "medium": 0.25 },
    "lead-time-for-changes": { "elite": 1, "high": 7, "medium": 30 },
    "change-failure-rate":  { "elite": 15, "high": 30, "medium": 45 },
    "mttr":                 { "elite": 1, "high": 24, "medium": 168 }
  },
  "targets": { "cycle-time": 3, "work-item-age": 4, "blocked-time": 10 }
}
```

**Pattern precedent:** `integrations.config` jsonb already drives `leadTimeMode` (read in
`lib/metrics/dora.ts:30`). This spec uses a dedicated table because metric definitions are
cross-cutting, not provider-scoped.
