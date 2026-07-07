---
layout: default
title: Architecture & Data Flow · DORA Dashboard
description: How data flows from GitLab and Jira into the dashboard, and who can access what — with diagrams.
---

<article class="doc" markdown="1">

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

## Security mechanisms (on Azure PaaS)

<p>The portal is designed to run as a managed container on <strong>Azure App Service</strong> or
<strong>Azure Container Apps</strong> — no Kubernetes required. The controls map cleanly onto
Azure PaaS primitives (Key Vault, Managed Identity, Private Endpoints, managed TLS):</p>

<ul>
<li><strong>Transport:</strong> <strong>free managed TLS certificates</strong> (auto-renewed) on
Container Apps / App Service, HTTPS-only; the app adds HSTS, a strict Content-Security-Policy,
<code>X-Frame-Options: DENY</code>, <code>nosniff</code> and a locked-down Permissions-Policy.</li>
<li><strong>Authentication:</strong> Auth.js (NextAuth) — local username/password (bcrypt) and
<strong>Azure Entra ID SSO</strong> (OIDC); secure <code>HttpOnly</code>/<code>Secure</code>
cookies. App Service "Easy Auth" can front the app as an extra layer if desired.</li>
<li><strong>Authorisation:</strong> default-deny middleware; role-based access (Admin/Lead/Viewer)
enforced server-side on every privileged action.</li>
<li><strong>Secrets:</strong> integration tokens and SSO client secrets are encrypted with
<strong>AES-256-GCM</strong> before storage and never returned to the browser. Platform secrets
(DB URL, session/encryption keys) live in <strong>Azure Key Vault</strong> and are read at runtime
via <strong>Managed Identity</strong> (App Service Key Vault references / Container Apps secrets) —
never baked into the image or config.</li>
<li><strong>Network isolation:</strong> <strong>Azure Database for PostgreSQL Flexible Server</strong>
is reached over <strong>VNet integration + a Private Endpoint</strong> with public access disabled —
the database has no internet exposure; no third-party data egress.</li>
<li><strong>Identity, not credentials:</strong> a <strong>user-assigned Managed Identity</strong>
handles container-registry pull (ACR), Key Vault access, and optionally Entra authentication to
PostgreSQL — so there are no stored infrastructure passwords.</li>
<li><strong>Least privilege:</strong> the GitLab token needs only <code>read_api</code> (or the
equivalent fine-grained group read); the app only ever reads from sources.</li>
<li><strong>Audit &amp; monitoring:</strong> every privileged action (sign-in, user/role change,
integration save, sync) is written to an append-only audit log; container logs and metrics stream
to <strong>Azure Monitor / Log Analytics</strong>.</li>
<li><strong>Supply chain:</strong> non-root, minimal, capability-dropped container image; scanning
with <strong>Microsoft Defender for Containers</strong> (or Trivy in CI), plus SBOM and image
signing in the pipeline.</li>
</ul>

<div class="note"><strong>Web-security posture (OWASP ZAP-reviewed).</strong> The Content-Security-Policy
sets <code>default-src 'self'</code>, <code>object-src 'none'</code>, <code>frame-ancestors 'none'</code>,
<code>frame-src 'none'</code>, <code>base-uri 'self'</code>, <code>form-action 'self'</code> and
<code>upgrade-insecure-requests</code>. <code>script-src</code> retains <code>'unsafe-inline'</code> —
a known Next.js hydration constraint; a nonce-based strict CSP is a planned follow-up.
<strong>CSRF</strong> is handled by Next.js Server Actions (same-origin enforcement), so no additional
tokens are required. Responses are typed and served with <code>X-Content-Type-Options: nosniff</code>.</div>

<div class="note"><strong>Kubernetes is optional.</strong> The same image also ships with a Helm
chart for AKS/Kubernetes, but Azure App Service and Container Apps are the recommended,
lower-ops path for most customers. See <a href="{{ '/azure/' | relative_url }}">Deploy to Azure</a>.</div>

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
<tr><td>Deployment</td><td>Azure Container Apps / App Service (Docker) · Helm/AKS optional</td><td>Managed TLS, Key Vault, Managed Identity, Private Endpoint</td></tr>
</tbody>
</table>
</div>

<p><a href="{{ '/azure/' | relative_url }}">→ Deploy to Azure (App Service / Container Apps)</a> ·
<a href="{{ '/install/' | relative_url }}">→ Kubernetes / Helm</a> ·
<a href="{{ '/metrics/' | relative_url }}">→ Metrics guide</a></p>

</article>
