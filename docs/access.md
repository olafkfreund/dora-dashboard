---
layout: default
title: Access & Configuration Checklist · DORA Dashboard
description: Everything an operator needs to provide and configure — credentials, scopes, and the decisions that make each metric live.
---

<article class="doc" markdown="1">

<p class="eyebrow">Documentation</p>

# Access &amp; Configuration Checklist

<p class="lead">
A single runbook of what to provide and configure to bring the portal fully online —
credentials, scopes, where each goes, and the two decisions that shape a couple of metrics.
All secrets are entered in <strong>Settings</strong>, encrypted at rest (AES-256-GCM), and never
shown again.
</p>

## 1. GitLab — primary DORA source (required)

<div class="table-wrap" markdown="0">
<table>
<thead><tr><th>Item</th><th>Value / scope</th></tr></thead>
<tbody>
<tr><td>Base URL</td><td><code>https://gitlab.com</code> or your self-managed URL</td></tr>
<tr><td>Group or project path</td><td>e.g. <code>my-group</code> or <code>my-group/my-project</code> — <em>no</em> host prefix</td></tr>
<tr><td>Production environment name</td><td>the GitLab environment that counts as production (default <code>production</code>)</td></tr>
<tr><td>Access token</td><td>a PAT with <code>read_api</code>, <em>or</em> a fine-grained token with group read: Deployment, Pipeline, Environment, Merge Request, Project (and Job/Job-Artifact for coverage)</td></tr>
</tbody>
</table>
</div>

<p><strong>Configure in:</strong> Settings → GitLab → Save → Test connection → Sync now.
<strong>Unlocks:</strong> Deployment Frequency, Change Failure Rate, Lead Time, MTTR (and Test
Automation Coverage — see below).</p>

<div class="warn"><strong>Fine-grained tokens</strong> often lack <em>User: Read</em>; the app
validates access to your configured <em>group</em> (not <code>/user</code>), so those tokens pass.</div>

## 2. Jira — flow, velocity &amp; quality (required for 7 metrics)

<div class="table-wrap" markdown="0">
<table>
<thead><tr><th>Item</th><th>Value / scope</th></tr></thead>
<tbody>
<tr><td>Base URL</td><td><code>https://your-org.atlassian.net</code></td></tr>
<tr><td>Service-account email</td><td>a read-only account is ideal</td></tr>
<tr><td>API token</td><td>Atlassian API token for that account</td></tr>
<tr><td>Scopes / permissions</td><td>Browse Projects, View Sprints/Boards, read issues + changelog</td></tr>
<tr><td>Project/board → team mapping</td><td>which Jira projects/boards belong to which team</td></tr>
<tr><td>Defect labels <em>(for quality)</em></td><td>tag bugs: a <code>post-release</code>/<code>production</code> label (escaped) and a <code>requirements</code>/<code>design</code> label (upstream root cause)</td></tr>
</tbody>
</table>
</div>

<p><strong>Configure in:</strong> Settings → Jira → Save → Test connection → Sync now.
<strong>Unlocks:</strong> Cycle Time, Work Item Age, Blocked Time, Average Velocity, Delivery
Predictability, Defect Escape Rate, Defect Root Cause. (Story-Points and Sprint custom fields are
auto-detected by name.)</p>

## 3. Test Automation Coverage — no new credentials

<p>Uses the <strong>existing GitLab token</strong> (Job/Job-Artifact read). The only requirement is
that your CI pipelines <strong>publish a coverage value</strong> (a coverage regex or a coverage
artifact) — the app reads each project's latest pipeline coverage and averages it.</p>

## 4. Single sign-on (optional)

<div class="table-wrap" markdown="0">
<table>
<thead><tr><th>Provider</th><th>What to provide</th><th>Redirect URI</th></tr></thead>
<tbody>
<tr><td><strong>Azure Entra ID</strong> (SSO)</td><td>Application (client) ID, Directory (tenant) ID, client secret</td><td><code>https://&lt;host&gt;/api/auth/callback/microsoft-entra-id</code></td></tr>
<tr><td><strong>GitHub OAuth</strong> (behind <code>FEATURE_GITHUB</code>)</td><td>Client ID, client secret</td><td><code>https://&lt;host&gt;/api/auth/callback/github</code></td></tr>
</tbody>
</table>
</div>

<p><strong>Configure in:</strong> Settings → Single sign-on. Add the redirect URI in the provider's
app registration. Local username/password works out of the box (bootstrap admin).</p>

## 5. Platform secrets (deployment)

<ul>
<li><code>AUTH_SECRET</code> — signs sessions (<code>openssl rand -base64 32</code>).</li>
<li><code>APP_ENCRYPTION_KEY</code> — 32-byte base64; encrypts integration tokens at rest.</li>
<li><code>DATABASE_URL</code> — a managed PostgreSQL (RDS / Azure Flexible Server) for durability. Both are generated/preserved by the chart or passed at deploy time — never committed.</li>
</ul>

## 6. Two decisions

<div class="table-wrap" markdown="0">
<table>
<thead><tr><th>Metric</th><th>Decision</th></tr></thead>
<tbody>
<tr><td><strong>Lead Time</strong></td><td>Keep GitOps (deploy-commit ≈ 0 for infra repos) or measure from the feature MR's first commit (more meaningful for feature-branch workflows).</td></tr>
<tr><td><strong>MTTR</strong></td><td>Keep the deploy-recovery proxy (failed → next success) or record <strong>incidents in GitLab</strong> and switch to incident open→close.</td></tr>
</tbody>
</table>
</div>

## At-a-glance

<div class="table-wrap" markdown="0">
<table>
<thead><tr><th>To light up…</th><th>Provide</th></tr></thead>
<tbody>
<tr><td>DORA-4 (4 metrics)</td><td>GitLab token + group + prod env</td></tr>
<tr><td>Flow + Velocity + Quality (7 metrics)</td><td>Jira URL + email + API token (+ defect labels)</td></tr>
<tr><td>Test Automation Coverage (1 metric)</td><td>GitLab pipelines that publish coverage</td></tr>
<tr><td>Enterprise sign-in</td><td>Entra ID (and/or GitHub OAuth) app registration</td></tr>
</tbody>
</table>
</div>

<p><a href="{{ '/metrics/' | relative_url }}">→ Metrics guide</a> ·
<a href="{{ '/install/' | relative_url }}">→ Kubernetes / Helm</a> ·
<a href="{{ '/azure/' | relative_url }}">→ Deploy to Azure</a></p>

</article>
