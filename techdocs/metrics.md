# Metric Catalog

Every card on the dashboard explained: **what it measures**, **where the data comes
from**, and **how it is calculated**. DORA-4 metrics are computed live from GitLab; the
extended flow, velocity, and quality metrics come from Jira and GitLab CI. All metrics are
computed and displayed at **team / group level only** — the product deliberately does not
rank individual developers.

Each detail view also shows the exact formula, a "Data source" line, the target/benchmark
and a coloured performance tier (Elite/High/Medium/Low), an "Active rules · lineage" panel
(the configured definition behind the number), a data-aware "Why this value" explanation,
and a drill-down breakdown table. The dashboard can **Export PDF** and **Export CSV**
branded reports, and can send a scheduled **delivery digest** by email or Teams/Slack
webhook.

## Where the numbers come from

| Group | Metric | Source | Status |
| --- | --- | --- | --- |
| DORA-4 | Deployment Frequency | GitLab deployments | live |
| DORA-4 | Lead Time for Changes | GitLab deployments + commits | live |
| DORA-4 | Change Failure Rate | GitLab deployments (+ Jira signal) | live |
| DORA-4 | Mean Time to Restore | GitLab deployments (recovery) | live |
| Flow | Cycle Time | Jira transitions | live |
| Flow | Work Item Age | Jira (open items) | live |
| Flow | Blocked Time | Jira (blocked status) | live |
| Flow | Delivery Predictability | Jira PIs (P1–P6) | live |
| Flow | Feature Cycle Time | Jira Features (parent) | live |
| Flow | PR Cycle Time | GitLab merged merge requests | live |
| Velocity & Quality | Average Velocity | Jira PIs (P1–P6) | live |
| Velocity & Quality | Investment Allocation | Jira issue type + labels | live |
| Velocity & Quality | Test Automation Coverage | GitLab CI coverage | live |
| Velocity & Quality | Defect Escape Rate | Jira defects + releases | live |
| Velocity & Quality | Defect Root Cause | Jira defect categorisation | live |

## How each Jira metric is derived (fields and formulas)

Every Jira metric is computed from ingested issue data — never a live query. Custom fields
vary per instance, so the ingestor **auto-detects them by name** (the IDs below are this
instance's placeholders). From each issue's changelog we derive three timing signals once,
at ingest, and store them: `inProgressAt` (first transition out of the initial status),
`resolvedAt` (resolution date), and `blockedSeconds` (time in a Blocked/On-Hold/Impediment
status). **Sub-tasks are excluded** from flow, velocity and allocation (they sit under
Stories and would double-count).

| Metric | Jira source (field / signal) | Scope | Formula |
| --- | --- | --- | --- |
| Cycle Time | `createdAt`, `resolvedAt` | Done items, no sub-tasks | median(resolved − created); per-PI drill-down counts each issue in every PI it belongs to |
| Work Item Age | changelog → `inProgressAt` | currently In Progress, no sub-tasks / parked | mean(now − in-progress) |
| Blocked Time | changelog → time in a Blocked/On-Hold/Impediment status | items ever blocked | Σ blocked ÷ Σ lifetime of ever-blocked items × 100 |
| Feature Cycle Time | issue type *Feature* + `inProgressAt`/`resolvedAt` | resolved Features | median(resolved − started) |
| Average Velocity | Story Points (`cf10002`) + Program Increment (`cf10001`, multi-value) + status | Done, no sub-tasks | mean(completed points) per PI (P1–P6); an issue in several PIs counts toward each |
| Delivery Predictability | Story Points + Program Increment (multi-value) + status | no sub-tasks | completed ÷ committed points per PI; mean across PIs |
| Investment Allocation | issue type + labels, weighted by Story Points | no sub-tasks | points per category ÷ total × 100 (Feature/KTLO/Debt/Support) |
| Defect Escape Rate | Environment Type (`cf10005`) | Bug/Incident with an environment | Production ÷ all-with-environment × 100 |
| Defect Root Cause | Root Cause Analysis (`cf10004`) | Bug/Incident, triaged | (Requirements + Design) ÷ triaged × 100 |
| Change Failure Rate* | Jira Incidents + Production-env defects (`cf10005`) | window | failures ÷ GitLab prod deployments × 100 |
| MTTR (incident mode)* | Jira Incidents + Production defects | resolved in window | median(resolved − created) |

\* Change Failure Rate and incident-mode MTTR combine the Jira failure signal with GitLab
deployments — a failed GitLab deploy *job* is a job error, not a production failure.

## DORA-4 (live from GitLab)

### Deployment Frequency

**Source:** GitLab deployments to your production environment.

**What it measures.** How often you successfully ship to production — a core throughput
signal. Higher frequency usually means smaller, safer batches.

**How it is collected.** The ingestor calls the GitLab REST API
`GET /projects/:id/deployments?environment=production` for every project in your
configured group, and stores each deployment (status, environment, timestamps) in
Postgres.

```
count(successful production deployments) / weeks in range
```

Shown as deploys/week over an 8-week window, with a weekly trend.

*Real-life:* Your `example-org/platform` group ran roughly 750 production deployments over
8 weeks across about 40 projects → roughly 90+/week. That "Elite" throughput is typical of
a GitOps estate where many small services deploy independently.

### Lead Time for Changes

**Source:** GitLab deployments + the deployed commit's date.

**What it measures.** How long a change takes to go from *code committed* to *running in
production* — the speed of your delivery pipeline.

**How it is collected.** For each production deployment we read its commit SHA, then fetch
the commit's authored date via `GET /projects/:id/repository/commits/:sha` (backfilled in
batches). Lead time is the gap between that commit and the deployment finishing.

```
median(deployment.finished_at − deployed_commit.committed_at)
```

*Real-life:* For a feature-branch workflow, a change committed Monday and released
Wednesday = 2 days lead time. *Note for infra/GitOps repos:* when the deployed commit is
created *at deploy time*, lead time trends toward zero — accurate, but a reflection of the
workflow, not slow/fast delivery. For meaningful code lead time, measure from the feature
MR's first commit.

### Change Failure Rate

**Source:** GitLab deployment outcomes, combined with a Jira failure signal.

**What it measures.** The share of production deployments that fail and need remediation
(rollback, hotfix, re-run) — a quality/stability signal.

```
Jira Incidents + Production-env defects ÷ production deployments × 100
```

A failed GitLab *deploy job* is a job error, not a production failure, so change failures
are read from Jira (Incident issues + defects whose Environment Type is Production). If an
instance has no such signal, the portal falls back to failed-deploy-status ÷ deployments.

*Real-life:* 4 failed of 751 production deployments = 0.5% — comfortably "Elite" (≤ 15%).
A spike points you at a specific service or pipeline stage introducing regressions.

### Mean Time to Restore (MTTR)

**Source:** GitLab deployment recovery (proxy).

**What it measures.** How quickly service is restored after a failed change — your
resilience.

**How it is collected.** Per project we order deployments by time; for each `failed`
production deployment we find the next `success`. The gap is the recovery time. (GitLab's
own model now calls this "Failed Deployment Recovery Time".)

```
median(next successful deploy.finished_at − failed deploy.finished_at)
```

*Real-life:* A pipeline fails at 14:00 and a fixed re-run succeeds at 14:20 → 20-minute
recovery. *Note:* if failures are simply retried within seconds, this reads near-zero. For
true incident MTTR, record incidents in GitLab (Incident Management) and the source
switches to incident open→close.

## Flow metrics (live from Jira)

The Jira ingestion (**Settings → Jira → Sync**) pulls the full window of issues with their
changelog, deriving `inProgressAt`, `resolvedAt` and `blockedSeconds`, and stores each
issue's story points, Program Increment (P1–P6), and parent Feature. Flow and velocity are
computed at the delivery level — **sub-tasks are excluded**. Velocity, Predictability and
the per-PI Cycle Time breakdown are grouped by **Program Increment**, which is a
**multi-value field**: an issue can belong to several increments, and each membership is
counted separately.

### Cycle Time

**Source:** Jira issue created + resolution date.

**What it measures.** Time from when an issue is *created* (the request lands) until it is
*resolved* — request-to-done. This matches how the delivery teams and their Jira board
report cycle time. The code-side GitLab DORA *Lead Time for Changes* (commit → deploy) is a
separate metric.

```
median(resolved − created) for completed items (excludes sub-tasks)
```

The drill-down shows Cycle Time per Programme Increment across all history, counting each
completed issue in every PI it belongs to.

*Real-life:* A story raised on the 1st and marked *Done* on the 25th → 24-day cycle time.
Measuring *created → resolved* (rather than only *In Progress → Done*) reconciles the
dashboard with the teams' own per-PI Jira report.

### Work Item Age

**Source:** Jira open, in-progress items.

**What it measures.** The average age of items currently in progress — a *leading*
indicator of work at risk of stalling.

```
mean(now − work-started) for items currently In Progress
```

Only items whose current status is in the *In Progress* category count — items pushed back
to the backlog don't accrue age. Parked/abandoned statuses can be excluded in
**Settings → Metrics**.

*Real-life:* If three tickets have been "In Progress" for 10+ days, average age climbs — a
prompt to unblock them in the next stand-up before the sprint misses.

### Blocked Time

**Source:** Jira blocked/waiting status.

**What it measures.** Of the items that were ever blocked, the share of their lifetime
spent blocked — dependency and hand-off friction. Measuring only blocked items (not all
work) keeps the number from being diluted; the detail view also shows it as a share of all
work. Which Jira statuses count as "blocked" is configurable in **Settings → Metrics**
(blank = auto-detect any status named Blocked/On-Hold/Impediment).

```
sum(time blocked) ÷ sum(lifetime of items that were ever blocked) × 100
```

*Real-life:* Items waiting on an external API sign-off sit "Blocked" for days; if those
items spend 20% of their life blocked, that dependency is the drag to attack — even if it
is only ~1% of all work.

### Delivery Predictability

**Source:** Jira Program Increment (P1–P6) commitments.

**What it measures.** How much of the Program-Increment-committed work is actually
completed — planning reliability.

```
completed ÷ committed story points × 100, per Program Increment (mean across PIs)
```

*Real-life:* A team commits to 40 points and finishes 35 → 87% predictability. Stable
~85%+ means commitments are well-calibrated to capacity.

### Feature Cycle Time

**Source:** Jira Features (the parent issue type).

**What it measures.** How long a **Feature** — the delivery unit stakeholders track —
takes from work-started to done, rolling story-level flow up to the level people plan and
report at.

```
median(resolved − work-started) across resolved Features
```

The breakdown lists the slowest Features with their Program Increment.

*Real-life:* A Feature started in PI3 and closed in PI5 has a long cycle time — usually a
sign it should have been split into smaller, independently shippable slices.

### PR Cycle Time

**Source:** GitLab merged merge requests.

**What it measures.** How long a change takes from its first commit to merge, split into
**Coding → Pickup → Review → Deploy** stages so you can see where merge requests wait.

```
median(first commit → merge) across merged MRs; median per stage
```

The headline is measured across every merged MR. Because **Pickup** and **Review** need a
review timestamp, those two stages are measured from the subset of MRs that have one — so
the detail view shows each stage's median *and how many MRs it came from*, and the stages
don't necessarily sum to the total.

*Real-life:* If the total is 14h but Pickup is 19h across the reviewed MRs, the wait is
reviewers *starting* the review — an assignment/SLA problem, not slow reviewing.

## Velocity and Quality

**Test Automation Coverage** is read from GitLab CI: each sync stores the coverage % of
every project's latest pipeline (`pipelines/latest.coverage`), averaged across projects
that report coverage. **Defect Escape Rate** and **Defect Root Cause** are computed from
Jira defects (issue type Bug/Defect/Incident) using dedicated defect fields: Environment
Type (`cf10005`) drives the escape rate, and Root Cause Analysis (`cf10004`) drives root
cause. If those fields aren't present on an instance, the portal falls back to label-based
classification.

### Average Velocity

**Source:** Jira Program Increments (P1–P6).

**What it measures.** Average story points completed per Program Increment — used for
*forecasting*, never as a target to maximise.

```
mean(completed story points) per Program Increment (P1–P6)
```

*Real-life:* A steady ~700 pts/PI lets you forecast a large epic across Program
Increments. A sudden spike is a smell (scope inflation), not a win.

### Investment Allocation

**Source:** Jira issue type + labels, weighted by Story Points.

**What it measures.** Where delivery capacity goes, split across Feature / KTLO / Debt /
Support so leadership can see the balance of new value against keeping the lights on.

```
points per category ÷ total points × 100 (no sub-tasks)
```

### Test Automation Coverage

**Source:** GitLab CI test reports / coverage.

**What it measures.** Share of regression/integration testing that is automated — a
leading indicator of release confidence.

```
mean of each project's latest GitLab CI pipeline coverage %
```

*Real-life:* Rising coverage (e.g. 76% → 80%) typically precedes a falling Change Failure
Rate. Your pipelines must be configured to publish a coverage value (a coverage regex or a
coverage artifact).

### Defect Escape Rate

**Source:** Jira defects vs releases.

**What it measures.** Share of defects found *after* release vs before — lower means issues
are caught earlier.

```
defects with Environment Type = Production ÷ defects with an environment × 100
```

*Real-life:* If 6% of defects are found by customers after release, that is your "escape"
rate; it should fall as automation coverage rises.

### Defect Root Cause

**Source:** Jira defect categorisation.

**What it measures.** Proportion of defects requiring rework due to *upstream* causes
(requirements, design, dependencies).

```
requirements + design ÷ triaged defects × 100 (from Root Cause Analysis)
```

*Real-life:* If 31% of defects trace to unclear requirements, the highest-leverage fix is
refinement/BA quality, not more testing.

## Benchmarks (DORA performance tiers)

| Metric | Elite | High | Medium | Low |
| --- | --- | --- | --- | --- |
| Deployment Frequency | On-demand (multiple/day) | Daily–weekly | Weekly–monthly | < monthly |
| Lead Time for Changes | < 1 day | 1 day–1 week | 1 week–1 month | > 1 month |
| Change Failure Rate | 0–15% | 16–30% | 16–30% | > 30% |
| Mean Time to Restore | < 1 hour | < 1 day | 1 day–1 week | > 1 week |

## Configuring metric definitions

The single most common cause of "these numbers look wrong" is a disagreement over **what
counts** — which environments are production, which branch ships, what a failure is.
Admins configure these under **Settings → Metrics**; changes are **audited** and take
effect immediately. Leaving everything blank reproduces the standard DORA behaviour.

| Setting | What it controls | Default |
| --- | --- | --- |
| Production environments | Only deployments to these environment names count. Comma-separated; blank = every environment. | all environments |
| Ref / branch pattern | Regex the deployment ref/branch must match (e.g. `^(main\|release/.*)$`). Blank = any. | any |
| Failure statuses | Which deployment statuses count as a change failure (drives Change Failure Rate and MTTR). | `failed` |
| Rolling window | Number of weeks of history each metric is computed over. | 8 weeks |
| Benchmark bands | The Elite / High / Medium thresholds per DORA metric (Low is anything beyond Medium). | standard DORA bands |

Filtering is applied at compute time against already-ingested deployments, so changing a
definition takes effect on the next page load with **no re-sync required**. Open any DORA
card's detail view to see an "Active rules · lineage" block showing the exact definition
behind the number — window, environment allowlist, ref pattern, failure statuses, and band
thresholds in force. This makes every figure defensible in an audit.

## Teams and per-team metrics

Under **Settings → Teams** an admin creates a team and assigns the GitLab projects and Jira
project keys that belong to it. A **team selector** then appears on the dashboard — pick a
team and every metric, breakdown and the exported report recompute for just that team's
work. In **Settings → Metrics**, switching the team selector to a squad gives it its own
targets, benchmark bands, deployment definition and rolling window, layered over the org
default. Filtering is compute-time, so assigning projects to a team needs **no re-sync**.
Everything stays at team/org level — never individuals.

See [Architecture](architecture.md) for how the data flows from GitLab/Jira into these
metrics, and [Configuration](configuration.md) for connecting the sources.
