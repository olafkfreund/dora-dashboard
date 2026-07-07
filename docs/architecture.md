---
layout: default
title: Architecture & Data Flow · DORA Dashboard
description: How data flows from GitLab and Jira into the dashboard, and who can access what — with diagrams.
---

<article class="doc">

<p class="eyebrow">Documentation</p>

# Architecture &amp; Data Flow

<p class="lead">
How the portal is built, how delivery data moves from <strong>GitLab</strong> and
<strong>Jira</strong> into the metrics you see, and <strong>who can access what</strong>.
Everything runs inside your own cluster — no third-party data egress.
</p>

## The big picture

<p>The portal is a single self-hosted Next.js application backed by PostgreSQL. It
<strong>ingests</strong> raw delivery events from GitLab (and Jira), <strong>computes</strong>
DORA-4 and flow metrics, and <strong>serves</strong> them to authenticated users behind SSO.</p>

{% raw %}
<pre class="mermaid">
flowchart LR
  subgraph Sources["External sources (read-only)"]
    GL["GitLab REST API v4"]
    JR["Jira REST API"]
  end
  subgraph Portal["DORA Dashboard — in your cluster"]
    ING["Ingestion worker"]
    DB[("PostgreSQL")]
    ENG["Metrics engine (DORA)"]
    APP["Next.js app (RSC + API)"]
  end
  U["Browser — authenticated user"]
  GL -->|deployments, MRs, commits| ING
  JR -->|issues, sprints| ING
  ING -->|idempotent upsert| DB
  DB --> ENG
  ENG -->|DORA-4 and flow metrics| APP
  APP -->|HTTPS / TLS| U
  U -->|Sync now / scheduled| ING
</pre>
{% endraw %}

<p><strong>Key points:</strong> the portal only ever <em>reads</em> from GitLab/Jira using a
least-privilege token; all processing and storage stay in-cluster; the browser only ever talks
to the app over TLS.</p>

## How ingestion works (GitLab)

<p>Ingestion is idempotent and incremental — a per-entity cursor means repeated syncs only fetch
what changed. Triggered manually (<em>Sync now</em>) or by a scheduler calling
<code>POST /api/sync/gitlab</code>.</p>

{% raw %}
<pre class="mermaid">
sequenceDiagram
  actor Admin
  participant App as DORA Dashboard
  participant GL as GitLab API
  participant DB as PostgreSQL
  Admin->>App: Sync now (or POST /api/sync/gitlab)
  App->>App: requireAdmin()
  App->>GL: list projects in group
  loop each project
    App->>GL: GET production deployments
    App->>GL: GET merged merge requests
    App->>DB: upsert (idempotent, by id)
  end
  App->>GL: GET commit dates (backfill)
  App->>DB: store committedAt (Lead Time)
  App-->>Admin: "Synced N deployments, M MRs..."
  Note over App,DB: Dashboard computes DORA-4 on next load
</pre>
{% endraw %}

## Data-flow access &amp; trust boundaries

<p>Access is <strong>default-deny</strong>: every route requires an authenticated session, and
privileged actions require the <em>Admin</em> role. Integration tokens are encrypted before they
ever touch the database.</p>

{% raw %}
<pre class="mermaid">
flowchart TB
  U2["User"] --> EDGE
  subgraph EDGE["Ingress — ingress-nginx + cert-manager"]
    TLS["HTTPS · Let's Encrypt TLS 1.3 · HSTS"]
  end
  TLS --> MW["Middleware (default-deny)"]
  MW --> AUTH["Auth.js — local login or Entra ID SSO"]
  AUTH --> ROLE{"Role?"}
  ROLE -->|Admin| ADM["Settings · Users · Sync integrations"]
  ROLE -->|Lead / Viewer| DASH["Dashboard (read-only)"]
  subgraph DATA["Data — encrypted"]
    SEC["Integration tokens: AES-256-GCM"]
    PG[("PostgreSQL — KMS-encrypted at rest")]
  end
  ADM -->|save token| SEC
  SEC --> PG
  ADM --> PG
  DASH --> PG
</pre>
{% endraw %}

<div class="table-wrap" markdown="0">
<table>
<thead><tr><th>Role</th><th>Dashboard</th><th>Settings / Integrations</th><th>Users</th><th>Sync</th></tr></thead>
<tbody>
<tr><td><strong>Admin</strong></td><td>✔ read</td><td>✔ configure</td><td>✔ manage</td><td>✔ trigger</td></tr>
<tr><td><strong>Lead</strong></td><td>✔ read</td><td>—</td><td>—</td><td>—</td></tr>
<tr><td><strong>Viewer</strong></td><td>✔ read</td><td>—</td><td>—</td><td>—</td></tr>
</tbody>
</table>
</div>

## Security mechanisms in place

<ul>
<li><strong>Transport:</strong> TLS 1.3 with HSTS; a strict Content-Security-Policy,
<code>X-Frame-Options: DENY</code>, <code>nosniff</code>, and a locked-down Permissions-Policy.</li>
<li><strong>Authentication:</strong> Auth.js (NextAuth) — local username/password (bcrypt) and
Azure Entra ID SSO (OIDC); secure <code>HttpOnly</code>/<code>Secure</code> cookies.</li>
<li><strong>Authorisation:</strong> default-deny middleware; role-based access (Admin/Lead/Viewer)
enforced server-side on every privileged action.</li>
<li><strong>Secrets:</strong> integration tokens and SSO client secrets are encrypted with
<strong>AES-256-GCM</strong> before storage and never returned to the browser; Kubernetes Secrets
are encrypted at rest with <strong>KMS</strong>.</li>
<li><strong>Isolation:</strong> PostgreSQL is cluster-internal only (never exposed); a
NetworkPolicy restricts DB access to the app’s own pods; no third-party data egress.</li>
<li><strong>Least privilege:</strong> the GitLab token needs only <code>read_api</code> (or the
equivalent fine-grained group read); the app only reads from sources.</li>
<li><strong>Audit:</strong> every privileged action (sign-in, user/role change, integration save,
sync) is written to an append-only audit log.</li>
<li><strong>Supply chain:</strong> non-root, minimal, capability-dropped container; image scanning,
SBOM and signing in CI (see the repo).</li>
</ul>

## Component overview

<div class="table-wrap" markdown="0">
<table>
<thead><tr><th>Layer</th><th>Technology</th><th>Responsibility</th></tr></thead>
<tbody>
<tr><td>UI / server</td><td>Next.js 16 (App Router, RSC + API routes), TypeScript</td><td>Auth, dashboard, settings, sync endpoints</td></tr>
<tr><td>Design system</td><td>shadcn/ui · Radix · Tailwind v4 (OKLCH)</td><td>Themed, accessible UI</td></tr>
<tr><td>Data layer</td><td>Drizzle ORM · postgres.js · PostgreSQL 16</td><td>Raw events, computed data, users, audit</td></tr>
<tr><td>Auth</td><td>Auth.js (NextAuth v5)</td><td>Local + Entra ID SSO, RBAC, sessions</td></tr>
<tr><td>Ingestion</td><td>GitLab REST v4 (Jira REST)</td><td>Deployments, MRs, commits → Postgres</td></tr>
<tr><td>Deployment</td><td>Docker · Helm · Kubernetes (EKS)</td><td>Hardened image, ingress-nginx, cert-manager</td></tr>
</tbody>
</table>
</div>

<p><a href="{{ '/install/' | relative_url }}">→ Installation &amp; configuration (Helm)</a> ·
<a href="{{ '/metrics/' | relative_url }}">→ Metrics guide</a></p>

</article>
