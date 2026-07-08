---
layout: default
title: Metrics Guide · DORA Dashboard
description: What each metric measures, how it is collected from GitLab and Jira, how it is calculated, and a real-life scenario.
---

<article class="doc" markdown="1">

<p class="eyebrow">Documentation</p>

# Metrics Guide

<p class="lead">
Every card on the dashboard explained: <strong>what it measures</strong>, <strong>where the
data comes from</strong>, <strong>how it is calculated</strong>, and a <strong>real-life
scenario</strong> so the number is easy to trust and act on.
</p>

<div class="note">
<strong>How to read a card.</strong> A small green <em>“live”</em> badge means the value is
computed from your connected data (GitLab). Cards without it show sample values until the
relevant source (e.g. Jira) is connected. Every card is clickable — the detail view shows the
definition, the exact formula, the target/benchmark, an 8-week trend, and an insight.
</div>

## Where the numbers come from

<div class="table-wrap" markdown="0">
<table>
<thead><tr><th>Group</th><th>Metric</th><th>Source</th><th>Status</th></tr></thead>
<tbody>
<tr><td rowspan="4">DORA-4</td><td>Deployment Frequency</td><td>GitLab deployments</td><td><span class="tag-live">live</span></td></tr>
<tr><td>Lead Time for Changes</td><td>GitLab deployments + commits</td><td><span class="tag-live">live</span></td></tr>
<tr><td>Change Failure Rate</td><td>GitLab deployments</td><td><span class="tag-live">live</span></td></tr>
<tr><td>Mean Time to Restore</td><td>GitLab deployments (recovery)</td><td><span class="tag-live">live</span></td></tr>
<tr><td rowspan="4">Flow</td><td>Cycle Time</td><td>Jira transitions</td><td><span class="tag-jira">Jira</span></td></tr>
<tr><td>Work Item Age</td><td>Jira (open items)</td><td><span class="tag-jira">Jira</span></td></tr>
<tr><td>Blocked Time</td><td>Jira (blocked status)</td><td><span class="tag-jira">Jira</span></td></tr>
<tr><td>Delivery Predictability</td><td>Jira sprints</td><td><span class="tag-jira">Jira</span></td></tr>
<tr><td rowspan="4">Velocity &amp; Quality</td><td>Average Velocity</td><td>Jira sprints</td><td><span class="tag-jira">Jira</span></td></tr>
<tr><td>Test Automation Coverage</td><td>GitLab CI coverage</td><td><span class="tag-jira">GitLab</span></td></tr>
<tr><td>Defect Escape Rate</td><td>Jira defects + releases</td><td><span class="tag-jira">Jira</span></td></tr>
<tr><td>Defect Root Cause</td><td>Jira defect categorisation</td><td><span class="tag-jira">Jira</span></td></tr>
</tbody>
</table>
</div>

<p>All metrics are computed and displayed at <strong>team / group level only</strong> — the
product deliberately does not rank individual developers.</p>

## DORA-4 (live from GitLab)

<div class="metric-doc" markdown="0">
<h3>Deployment Frequency <span class="tag-live">live</span></h3>
<p class="src">Source: GitLab deployments to your production environment</p>
<p><strong>What it measures.</strong> How often you successfully ship to production — a core
throughput signal. Higher frequency usually means smaller, safer batches.</p>
<p><strong>How it’s collected.</strong> The ingestor calls the GitLab REST API
<code>GET /projects/:id/deployments?environment=production</code> for every project in your
configured group, and stores each deployment (status, environment, timestamps) in Postgres.</p>
<code class="formula">count(successful production deployments) / weeks in range</code>
<p>Shown as deploys/week over an 8-week window, with a weekly trend.</p>
<div class="scenario"><strong>Real-life:</strong> Your <code>example-org/platform</code>
group ran ~750 production deployments over 8 weeks across ~40 projects → roughly
<strong>90+/week</strong>. That “Elite” throughput is typical of a GitOps estate where many
small services deploy independently.</div>
</div>

<div class="metric-doc" markdown="0">
<h3>Lead Time for Changes <span class="tag-live">live</span></h3>
<p class="src">Source: GitLab deployments + the deployed commit’s date</p>
<p><strong>What it measures.</strong> How long a change takes to go from <em>code committed</em>
to <em>running in production</em> — the speed of your delivery pipeline.</p>
<p><strong>How it’s collected.</strong> For each production deployment we read its commit SHA,
then fetch the commit’s authored date via
<code>GET /projects/:id/repository/commits/:sha</code> (backfilled in batches). Lead time is the
gap between that commit and the deployment finishing.</p>
<code class="formula">median(deployment.finished_at − deployed_commit.committed_at)</code>
<div class="scenario"><strong>Real-life:</strong> For a feature-branch workflow, a change
committed Monday and released Wednesday = 2 days lead time. <em>Note for infra/GitOps repos:</em>
when the deployed commit is created <em>at deploy time</em>, lead time trends toward zero — that
is accurate but reflects the workflow, not slow/fast delivery. For meaningful code lead time,
measure from the feature MR’s first commit.</div>
</div>

<div class="metric-doc" markdown="0">
<h3>Change Failure Rate <span class="tag-live">live</span></h3>
<p class="src">Source: GitLab deployment outcomes</p>
<p><strong>What it measures.</strong> The share of production deployments that fail and need
remediation (rollback, hotfix, re-run) — a quality/stability signal.</p>
<p><strong>How it’s collected.</strong> Each deployment’s <code>status</code>
(<code>success</code> / <code>failed</code>) is stored; the rate is failed over total.</p>
<code class="formula">failed deployments / (successful + failed) × 100</code>
<div class="scenario"><strong>Real-life:</strong> 4 failed of 751 production deployments =
<strong>0.5%</strong> — comfortably “Elite” (≤ 15%). A spike would point you at a specific
service or pipeline stage introducing regressions.</div>
</div>

<div class="metric-doc" markdown="0">
<h3>Mean Time to Restore (MTTR) <span class="tag-live">live</span></h3>
<p class="src">Source: GitLab deployment recovery (proxy)</p>
<p><strong>What it measures.</strong> How quickly service is restored after a failed change —
your resilience.</p>
<p><strong>How it’s collected.</strong> Per project we order deployments by time; for each
<code>failed</code> production deployment we find the next <code>success</code>. The gap is the
recovery time. (GitLab’s own model now calls this “Failed Deployment Recovery Time”.)</p>
<code class="formula">median(next successful deploy.finished_at − failed deploy.finished_at)</code>
<div class="scenario"><strong>Real-life:</strong> A pipeline fails at 14:00 and a fixed re-run
succeeds at 14:20 → 20-minute recovery. <em>Note:</em> if failures are simply retried within
seconds, this reads near-zero. For true incident MTTR, record incidents in GitLab
(Incident Management) and we’ll switch the source to incident open→close.</div>
</div>

## Flow metrics (from Jira)

<div class="note">
<strong>How the Jira flow &amp; velocity values are collected.</strong> The Jira ingestion
(<em>Settings → Jira → Sync</em>) pulls issues with their <strong>changelog</strong> and the boards'
<strong>sprints</strong>. From each issue's changelog we derive three timing signals and store them:
<code>inProgressAt</code> (first transition out of the initial status), <code>resolvedAt</code>
(resolution date), and <code>blockedSeconds</code> (total time spent in a Blocked/On-hold status).
Story points and the sprint are read from the issue's custom fields (auto-detected). The metrics
below are then computed from that stored data — they go <em>live</em> the moment a Jira token is
connected and a sync has run. Custom Story-Points/Sprint fields vary per Jira instance, so the
ingestor detects them by name.
</div>

<div class="metric-doc" markdown="0">
<h3>Cycle Time <span class="tag-jira">Jira</span></h3>
<p class="src">Source: Jira status transitions</p>
<p><strong>What it measures.</strong> Time from when work actively <em>starts</em> on an item to
when it is released — execution efficiency once work begins.</p>
<code class="formula">median(released_at − in_progress_at) for completed items</code>
<div class="scenario"><strong>Real-life:</strong> A story moves to <em>In Progress</em> on the
3rd and is <em>Done/Released</em> on the 6th → 3-day cycle time. Rising cycle time usually
points at a slow stage (e.g. testing hand-off).</div>
</div>

<div class="metric-doc" markdown="0">
<h3>Work Item Age <span class="tag-jira">Jira</span></h3>
<p class="src">Source: Jira open, in-progress items</p>
<p><strong>What it measures.</strong> The average age of items currently in progress — a
<em>leading</em> indicator of work at risk of stalling.</p>
<code class="formula">mean(now − in_progress_at) for items still open</code>
<div class="scenario"><strong>Real-life:</strong> If three tickets have been “In Progress” for
10+ days, average age climbs — a prompt to unblock them in the next stand-up before the sprint
misses.</div>
</div>

<div class="metric-doc" markdown="0">
<h3>Blocked Time <span class="tag-jira">Jira</span></h3>
<p class="src">Source: Jira blocked/waiting status</p>
<p><strong>What it measures.</strong> The percentage of an item’s life spent blocked — dependency
and hand-off friction.</p>
<code class="formula">sum(time in blocked status) / sum(total item lifetime) × 100</code>
<div class="scenario"><strong>Real-life:</strong> Items waiting on an external API sign-off sit
“Blocked” for days; if 12% of total lifetime is blocked, that dependency is your biggest drag.</div>
</div>

<div class="metric-doc" markdown="0">
<h3>Delivery Predictability <span class="tag-jira">Jira</span></h3>
<p class="src">Source: Jira sprint commitments</p>
<p><strong>What it measures.</strong> How much of the sprint-committed work is actually completed
— planning reliability.</p>
<code class="formula">completed story points / committed story points × 100</code>
<div class="scenario"><strong>Real-life:</strong> A team commits to 40 points and finishes 35 →
87% predictability. Stable ~85%+ means commitments are well-calibrated to capacity.</div>
</div>

## Velocity &amp; Quality

<div class="note">
<strong>How quality &amp; coverage are collected.</strong>
<strong>Test Automation Coverage</strong> is read from <strong>GitLab CI</strong>: each sync stores
the coverage % of every project's latest pipeline (<code>pipelines/latest.coverage</code>), and the
metric is the mean across projects that report coverage — so your pipelines must be configured to
publish a coverage value. <strong>Defect Escape Rate</strong> and <strong>Defect Root Cause</strong>
are computed from <strong>Jira defects</strong> (issue type Bug/Defect/Incident) using
<strong>labels</strong>: a post-release/production label marks an "escaped" defect, and a
requirements/design/analysis label marks an upstream root cause. Tag your defects with those labels
and the percentages compute automatically.
</div>

<div class="metric-doc" markdown="0">
<h3>Average Velocity <span class="tag-jira">Jira</span></h3>
<p class="src">Source: Jira sprints</p>
<p><strong>What it measures.</strong> Average story points completed per sprint over the last
3–5 sprints — used for <em>forecasting</em>, never as a target to maximise.</p>
<code class="formula">mean(completed story points) over last 5 sprints</code>
<div class="scenario"><strong>Real-life:</strong> A steady 42 pts/sprint lets you forecast a
100-point epic at ~2.5 sprints. A sudden spike is a smell (scope inflation), not a win.</div>
</div>

<div class="metric-doc" markdown="0">
<h3>Test Automation Coverage <span class="tag-jira">planned</span></h3>
<p class="src">Source: GitLab CI test reports / coverage</p>
<p><strong>What it measures.</strong> Share of regression/integration testing that is automated —
a leading indicator of release confidence.</p>
<code class="formula">automated test cases / total test cases × 100</code>
<div class="scenario"><strong>Real-life:</strong> Rising coverage (e.g. 76% → 80%) typically
precedes a falling Change Failure Rate. Collected from GitLab CI coverage/test-report artifacts.</div>
</div>

<div class="metric-doc" markdown="0">
<h3>Defect Escape Rate <span class="tag-jira">Jira</span></h3>
<p class="src">Source: Jira defects vs releases</p>
<p><strong>What it measures.</strong> Share of defects found <em>after</em> release vs before —
lower means issues are caught earlier.</p>
<code class="formula">defects found post-release / total defects × 100</code>
<div class="scenario"><strong>Real-life:</strong> If 6% of defects are found by customers after
release, that is your “escape” rate; it should fall as automation coverage rises.</div>
</div>

<div class="metric-doc" markdown="0">
<h3>Defect Root Cause <span class="tag-jira">Jira</span></h3>
<p class="src">Source: Jira defect categorisation</p>
<p><strong>What it measures.</strong> Proportion of defects requiring rework due to
<em>upstream</em> causes (requirements, design, dependencies).</p>
<code class="formula">upstream-caused defects / total defects × 100</code>
<div class="scenario"><strong>Real-life:</strong> If 31% of defects trace to unclear
requirements, the highest-leverage fix is refinement/BA quality, not more testing.</div>
</div>

## Benchmarks (DORA performance tiers)

<div class="table-wrap" markdown="0">
<table>
<thead><tr><th>Metric</th><th>Elite</th><th>High</th><th>Medium</th><th>Low</th></tr></thead>
<tbody>
<tr><td>Deployment Frequency</td><td>On-demand (multiple/day)</td><td>Daily–weekly</td><td>Weekly–monthly</td><td>&lt; monthly</td></tr>
<tr><td>Lead Time for Changes</td><td>&lt; 1 day</td><td>1 day–1 week</td><td>1 week–1 month</td><td>&gt; 1 month</td></tr>
<tr><td>Change Failure Rate</td><td>0–15%</td><td>16–30%</td><td>16–30%</td><td>&gt; 30%</td></tr>
<tr><td>Mean Time to Restore</td><td>&lt; 1 hour</td><td>&lt; 1 day</td><td>1 day–1 week</td><td>&gt; 1 week</td></tr>
</tbody>
</table>
</div>

## Configuring metric definitions

The single most common cause of "these numbers look wrong" is a disagreement over
**what counts** — which environments are production, which branch ships, what a failure is.
Admins can configure these definitions under **Settings → Metrics**; changes are **audited**
and take effect immediately. Leaving everything blank reproduces the standard DORA behaviour.

<div class="table-wrap" markdown="0">
<table>
<thead><tr><th>Setting</th><th>What it controls</th><th>Default</th></tr></thead>
<tbody>
<tr><td>Production environments</td><td>Only deployments to these environment names count. Comma-separated; blank = every environment.</td><td>all environments</td></tr>
<tr><td>Ref / branch pattern</td><td>Regex the deployment ref/branch must match (e.g. <code>^(main|release/.*)$</code>). Blank = any.</td><td>any</td></tr>
<tr><td>Failure statuses</td><td>Which deployment statuses count as a change failure (drives Change Failure Rate &amp; MTTR).</td><td><code>failed</code></td></tr>
<tr><td>Rolling window</td><td>Number of weeks of history each metric is computed over.</td><td>8 weeks</td></tr>
<tr><td>Benchmark bands</td><td>The Elite / High / Medium thresholds per DORA metric (Low is anything beyond Medium).</td><td>standard DORA bands</td></tr>
</tbody>
</table>
</div>

<div class="note">
<strong>Lineage.</strong> Open any DORA card's detail view to see an <em>“Active rules · lineage”</em>
block showing the exact definition behind that number — window, environment allowlist, ref
pattern, failure statuses, and the band thresholds in force. This makes every figure defensible
in an audit.
</div>

<p>Filtering is applied at compute time against already-ingested deployments, so changing a
definition takes effect on the next page load with <strong>no re-sync required</strong>. Use
<strong>Reset to DORA defaults</strong> to clear all overrides. Only <strong>Admins</strong> can
change these settings.</p>

<p><a href="{{ '/architecture/' | relative_url }}">→ See how the data flows from GitLab/Jira into these metrics</a></p>

</article>
