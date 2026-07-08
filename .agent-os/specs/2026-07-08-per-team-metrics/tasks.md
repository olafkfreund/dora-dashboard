# Spec Tasks

These are the tasks for the spec in @.agent-os/specs/2026-07-08-per-team-metrics/spec.md

> Created: 2026-07-08
> Status: Ready for Implementation
> Issue: #45

## Tasks

- [ ] 1. Teams model + assignment UI (`M`)
  - [ ] 1.1 `teams` table (slug pk, name, config jsonb, updatedAt/ById) + migration
  - [ ] 1.2 `lib/teams/store.ts` (server): list/get/upsert/delete teams (audited)
  - [ ] 1.3 Distinct-values helper: ingested GitLab project paths + Jira project keys
  - [ ] 1.4 Settings → Teams panel: create/edit, multi-select projects + keys, delete
  - [ ] 1.5 Verify: admin creates team, assignment persisted + audited; non-admin blocked

- [ ] 2. Team filter in compute (`M`)
  - [ ] 2.1 `TeamFilter` type + resolve a slug → filter (project paths + jira keys)
  - [ ] 2.2 Thread optional filter into `dora.ts` (WHERE projectPath IN …)
  - [ ] 2.3 Thread into `jira-metrics.ts` (WHERE projectKey IN …; sprints via team issues)
  - [ ] 2.4 Thread into `coverage.ts` + `pr-cycle.ts`
  - [ ] 2.5 Verify: filtered counts match a manual `WHERE` query; no filter = today's numbers

- [ ] 3. Dashboard team selector + report (`M`)
  - [ ] 3.1 Team dropdown component; `?team=<slug>` search param
  - [ ] 3.2 `app/page.tsx` reads param → resolves filter → passes to compute
  - [ ] 3.3 Report routes (`/api/report/pdf|csv`) accept `?team` and label the team
  - [ ] 3.4 Verify: switching team recomputes cards; "All teams" == org default

- [ ] 4. Per-team metric config (`M`)
  - [ ] 4.1 `metric_config` supports `team:<slug>` rows; `getMetricConfig(slug?)` merges team → org → defaults
  - [ ] 4.2 Settings → Metrics scoped by the selected team
  - [ ] 4.3 Cards + lineage panel use the team-effective config
  - [ ] 4.4 Verify: a team band override changes that team's tier only

- [ ] 5. Docs + ship (`S`)
  - [ ] 5.1 docs: "Teams & per-team metrics" section
  - [ ] 5.2 Zero-downtime deploy (build → GHCR → helm upgrade); close #45

## Notes

- P1–P3 = core "filter by team" (most of the value). P4 = per-team targets/bands.
- No re-ingest: filtering is compute-time on existing rows.
- Keep DEC-003: team/org level only, never individuals.
