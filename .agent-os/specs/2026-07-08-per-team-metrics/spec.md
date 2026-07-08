# Spec Requirements Document

> Spec: Per-team metrics — teams model, mapping, filtering & per-team config
> Created: 2026-07-08
> Status: Planning
> Issue: #45 (follow-on to #19)

## Overview

Let engineering leaders view the dashboard (and report) filtered to a single **team/squad**,
and set **per-team targets and benchmark bands** — while org-level (all-teams) stays the default.
Everything is computed at team/org level only (no individual ranking — DEC-003).

## Background (grounded in current data)

- All ingested tables carry the join keys: GitLab `projectId`/`projectPath` (2 distinct today),
  Jira `projectKey` (52 distinct), sprints `boardId`.
- **A team = a set of GitLab projects + a set of Jira project keys.** Filtering is a
  compute-time `WHERE … IN (team list)` in each DB wrapper — the pure compute functions are
  unchanged and **no re-ingest is needed**.
- `metric_config` (from #19) is org-level; this spec adds optional per-team override rows.

## User Stories

### Lead filters to their squad
As a **Lead**, I want to pick my team from a selector and see every metric recomputed for just
that team's GitLab projects + Jira boards, so the numbers reflect my squad.

### Admin assigns work to teams
As an **Admin**, I want to create teams and assign GitLab projects and Jira project keys to them,
so the dashboard can slice by team. Changes are audited.

### Lead sets team targets
As a **Lead**, I want per-team targets and Elite/High/Medium bands that override the org default,
so each squad is measured against its own goals.

## Spec Scope

1. **Teams model** — `teams` table (slug, name, config `{gitlabProjects[], jiraProjectKeys[]}`, audited) + migration.
2. **Team assignment UI** — Settings → Teams: create/edit teams, multi-select GitLab projects + Jira keys from the distinct ingested values.
3. **Team filter in compute** — optional filter threaded into `dora`, `jira-metrics`, `coverage`, `pr-cycle` DB wrappers (`WHERE projectId/projectKey IN …`); pure computes untouched.
4. **Dashboard team selector** — a dropdown; `?team=<slug>` search param drives the server render; "All teams" = org-level default. Report (PDF/CSV) honours `?team`.
5. **Per-team metric config** — `metric_config` gains optional `team:<slug>` rows; `getMetricConfig(teamSlug?)` merges team → org → built-in defaults.

## Out of Scope

- Auto-discovering teams from GitLab groups / Jira components (manual assignment for v1).
- Restricting *which* teams a user can see (all authenticated users see all teams for now).
- Individual-developer metrics (permanently out — DEC-003).

## Expected Deliverable

1. An admin creates a team and assigns GitLab projects + Jira keys (audited).
2. Selecting a team on the dashboard recomputes all 12+ metrics for that team; "All teams" reproduces today's org-level numbers exactly.
3. The PDF/CSV report reflects the selected team.
4. Per-team targets/bands override the org default in both the cards and the lineage panel.

## Design Notes

**`teams.config` jsonb:**
```jsonc
{ "gitlabProjects": ["example-org/platform/backend"], "jiraProjectKeys": ["DEMO", "PLAT"] }
```

**Filter shape passed to DB wrappers:**
```ts
type TeamFilter = { gitlabProjectPaths: string[]; jiraProjectKeys: string[] } | null // null = all teams
```
- `dora` / `coverage` / `pr-cycle`: `WHERE projectPath IN (gitlabProjectPaths)` (empty list → no rows for that team).
- `jira-metrics`: `WHERE projectKey IN (jiraProjectKeys)`; velocity uses the team's issues' sprintIds.

**Per-team config:** reuses the #19 `metric_config` table + `parseConfig` merge; `team:<slug>` row is a partial merged over the org `default` row.

## Phasing

- **P1** teams table + assignment UI · **P2** team filter in compute · **P3** dashboard selector + report · **P4** per-team config · **P5** docs + deploy + close #45.
- P1–P3 deliver the core "filter by team" value; P4 adds the per-team targets/bands from the issue title.
