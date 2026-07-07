---
layout: default
title: Installation & Configuration · DORA Dashboard
description: Install the portal in the cloud with Helm — prerequisites, chart values, TLS, secrets, GitLab configuration, scaling, upgrades and troubleshooting.
---

<article class="doc">

<p class="eyebrow">Documentation</p>

# Installation &amp; Configuration

<p class="lead">
Deploy the self-hosted DORA Dashboard into Kubernetes with the bundled Helm chart —
including TLS, secrets, GitLab configuration, scaling and upgrades. A Docker path is included
for local evaluation.
</p>

## Prerequisites

<ul>
<li>A Kubernetes cluster (tested on <strong>AWS EKS</strong>) and <code>kubectl</code> + <code>helm</code> v3/v4.</li>
<li><strong>ingress-nginx</strong> (an <code>IngressClass</code> named <code>nginx</code>).</li>
<li><strong>cert-manager</strong> with a <code>ClusterIssuer</code> (e.g. <code>letsencrypt-prod</code>) for TLS.</li>
<li>Either a working block-storage <code>StorageClass</code> (for the bundled PostgreSQL PVC) or a managed database (RDS) — see <a href="#database--persistence">Database</a>.</li>
<li>A container registry the cluster can pull from (the image ships on GHCR).</li>
</ul>

## Quick evaluation with Docker

<pre><code>docker build -t dora-dashboard:local .
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://dora:dora@host:5432/dora \
  -e AUTH_SECRET="$(openssl rand -base64 32)" \
  -e APP_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  dora-dashboard:local</code></pre>

<div class="note"><strong>Two required secrets.</strong> <code>AUTH_SECRET</code> signs sessions;
<code>APP_ENCRYPTION_KEY</code> (32-byte base64) encrypts integration tokens at rest. Generate both
with <code>openssl rand -base64 32</code>.</div>

## Install with Helm

<p>The chart lives at <code>charts/dora-dashboard</code>. A ready-made overlay for EKS is provided
at <code>values-aws.yaml</code>.</p>

<pre><code>helm upgrade --install dora-dashboard charts/dora-dashboard \
  --namespace dora --create-namespace \
  -f charts/dora-dashboard/values-aws.yaml \
  --set image.tag=&lt;git-sha&gt; \
  --wait --timeout 10m</code></pre>

<p>Or use the one-shot helper (creates the GHCR pull secret, deploys, verifies):</p>
<pre><code>AWS_PROFILE=your-profile deploy/install-aws.sh &lt;image-tag&gt;</code></pre>

<p>After install, read the generated bootstrap admin password:</p>
<pre><code>kubectl get secret dora-dashboard -n dora \
  -o jsonpath='{.data.BOOTSTRAP_ADMIN_PASSWORD}' | base64 -d ; echo</code></pre>

## Chart values reference

<p>Everything is configurable via <code>values.yaml</code> (override with <code>-f</code> or <code>--set</code>). Most-used values:</p>

<div class="table-wrap" markdown="0">
<table>
<thead><tr><th>Value</th><th>Default</th><th>Purpose</th></tr></thead>
<tbody>
<tr><td><code>image.repository</code> / <code>image.tag</code></td><td>ghcr.io/olafkfreund/dora-dashboard</td><td>Container image. Pin <code>tag</code> to an immutable git SHA.</td></tr>
<tr><td><code>replicaCount</code></td><td>1</td><td>App replicas.</td></tr>
<tr><td><code>ingress.host</code></td><td><code>&lt;ELB-IP&gt;.nip.io</code></td><td>Public hostname served over TLS.</td></tr>
<tr><td><code>ingress.className</code></td><td><code>nginx</code></td><td>Ingress controller class.</td></tr>
<tr><td><code>ingress.clusterIssuer</code></td><td><code>letsencrypt-prod</code></td><td>cert-manager issuer for the TLS cert.</td></tr>
<tr><td><code>secrets.create</code></td><td><code>true</code></td><td>Generate & preserve AUTH_SECRET / APP_ENCRYPTION_KEY / DB password.</td></tr>
<tr><td><code>secrets.existingSecret</code></td><td>""</td><td>Use an externally-managed Secret instead.</td></tr>
<tr><td><code>secrets.databaseUrl</code></td><td>""</td><td>External DB (RDS) URL; used when <code>postgres.enabled=false</code>.</td></tr>
<tr><td><code>postgres.enabled</code></td><td><code>true</code></td><td>Bundle an in-cluster PostgreSQL (disable to use RDS).</td></tr>
<tr><td><code>postgres.persistence.enabled</code></td><td><code>true</code></td><td>Use a PVC (needs a StorageClass) vs ephemeral <code>emptyDir</code>.</td></tr>
<tr><td><code>postgres.storageClass</code> / <code>storage</code></td><td>"" / 5Gi</td><td>PVC storage class and size.</td></tr>
<tr><td><code>migrate.initContainer</code></td><td><code>true</code></td><td>Run schema migrations + bootstrap seed on every pod start (idempotent).</td></tr>
<tr><td><code>autoscaling.enabled</code></td><td><code>false</code></td><td>HPA (needs metrics-server).</td></tr>
<tr><td><code>networkPolicy.enabled</code></td><td><code>true</code></td><td>Restrict DB access to the app’s own pods.</td></tr>
<tr><td><code>updateStrategy.maxSurge</code> / <code>maxUnavailable</code></td><td>1 / 0</td><td>Rollout strategy (set <code>maxSurge: 0</code> on capacity-constrained nodes).</td></tr>
<tr><td><code>bootstrap.adminEmail</code></td><td><code>admin@dora.local</code></td><td>First admin; password is generated once.</td></tr>
</tbody>
</table>
</div>

## TLS &amp; ingress

<p>Set <code>ingress.host</code> to your hostname and <code>ingress.clusterIssuer</code> to your
cert-manager issuer. The chart annotates the Ingress with
<code>cert-manager.io/cluster-issuer</code>, so a Let’s Encrypt certificate is issued
automatically. Watch it with:</p>
<pre><code>kubectl get certificate -n dora</code></pre>

<div class="tip"><strong>nip.io tip.</strong> With ingress-nginx you can use
<code>&lt;ELB-IP&gt;.nip.io</code> (or <code>dora.&lt;ELB-IP&gt;.nip.io</code>) as the host with no DNS
setup — the wildcard service resolves the embedded IP.</div>

## Secrets &amp; security

<ul>
<li><code>AUTH_SECRET</code> and <code>APP_ENCRYPTION_KEY</code> are generated on first install and
<strong>preserved across upgrades</strong> (via <code>lookup</code>) so sessions and encrypted
tokens survive rollouts.</li>
<li>Integration tokens are encrypted with AES-256-GCM before storage and never returned to the UI.</li>
<li>Enable etcd/KMS encryption on your cluster so Kubernetes Secrets are encrypted at rest.</li>
<li>The pod runs non-root with dropped capabilities and a RuntimeDefault seccomp profile.</li>
<li>Security headers (CSP, HSTS, X-Frame-Options DENY, nosniff, Permissions-Policy) are set by the app.</li>
</ul>

## Configure GitLab (primary DORA source)

<p>After signing in as admin, go to <strong>Settings → GitLab</strong> and set:</p>
<ul>
<li><strong>Base URL</strong> — <code>https://gitlab.com</code> or your self-managed URL.</li>
<li><strong>Group or project path</strong> — e.g. <code>my-group</code> or <code>my-group/my-project</code> (no host prefix).</li>
<li><strong>Production environment name</strong> — the GitLab environment that counts as production (default <code>production</code>).</li>
<li><strong>Access token</strong> — a PAT with <code>read_api</code>, or a fine-grained token with group read (Deployment / Pipeline / Environment / Merge Request / Project read).</li>
</ul>
<p>Click <strong>Save → Test connection</strong> (validates access to the configured group), then
<strong>Sync now</strong>. DORA-4 metrics go “live” on the dashboard.</p>

<div class="warn"><strong>Fine-grained tokens.</strong> These often lack <em>User: Read</em>, so a
generic <code>/user</code> check would 403 — the app validates access to your configured
<em>group</em> instead, which is what ingestion actually needs.</div>

### Scheduled sync

<p>For automatic ingestion, call the protected endpoint from a CronJob or scheduler:</p>
<pre><code>curl -X POST https://&lt;host&gt;/api/sync/gitlab \
  -H "Authorization: Bearer $SYNC_TOKEN"</code></pre>
<p>Set a shared <code>SYNC_TOKEN</code> env on the app for non-interactive callers (an admin
session also works).</p>

## Database &amp; persistence

<p>For production, use a managed database:</p>
<pre><code>helm upgrade --install dora-dashboard charts/dora-dashboard -n dora \
  --set postgres.enabled=false \
  --set secrets.databaseUrl="postgresql://user:pass@your-rds:5432/dora"</code></pre>
<p>To keep the in-cluster PostgreSQL but make it durable, install the EBS CSI driver (or your
cloud’s block storage) and set <code>postgres.persistence.enabled=true</code> with a valid
<code>storageClass</code>. With persistence off, the bundled DB is ephemeral (fine for demos; the
migrate init-container re-seeds schema + admin on restart).</p>

## Upgrade &amp; rollback

<pre><code># upgrade to a new immutable image
helm upgrade dora-dashboard charts/dora-dashboard -n dora \
  -f charts/dora-dashboard/values-aws.yaml --set image.tag=&lt;new-sha&gt; --wait

# roll back if needed
helm rollback dora-dashboard -n dora</code></pre>
<p>Schema migrations run automatically (idempotent) via the migrate init-container on each new pod.</p>

## CI/CD (GitHub Actions)

<ul>
<li><code>ci.yml</code> — install, lint, typecheck, run migrations, unit tests, build; Helm lint/template.</li>
<li><code>deploy.yml</code> — build &amp; push the image to GHCR (with Trivy scan), assume an AWS OIDC role, and <code>helm upgrade</code> into EKS. Set the <code>AWS_ROLE_ARN</code> repo secret.</li>
</ul>

## Troubleshooting

<div class="table-wrap" markdown="0">
<table>
<thead><tr><th>Symptom</th><th>Likely cause &amp; fix</th></tr></thead>
<tbody>
<tr><td>Pod <code>ImagePullBackOff</code></td><td>Private image — ensure the <code>ghcr-pull</code> secret exists (the installer creates it) or make the package public.</td></tr>
<tr><td>PVC <code>Pending</code></td><td>No block-storage provisioner — set <code>postgres.persistence.enabled=false</code> or install the EBS CSI driver.</td></tr>
<tr><td>Migrate Job won’t schedule</td><td>Node at pod cap — the migrate <em>init-container</em> handles it (Job is opt-in via <code>migrate.enabled</code>).</td></tr>
<tr><td>“Test connection” shows 403</td><td>Token scope — use <code>read_api</code>, or for fine-grained tokens ensure group read; set the group/project path (no <code>gitlab.com/</code> prefix).</td></tr>
<tr><td>Sync returns 504</td><td>Large group — raise the ingress proxy timeout (<code>nginx.ingress.kubernetes.io/proxy-read-timeout</code>); the sync still completes server-side.</td></tr>
<tr><td>Certificate not <code>Ready</code></td><td>Check the cert-manager <code>ClusterIssuer</code> and that the host resolves to the ingress.</td></tr>
</tbody>
</table>
</div>

<p><a href="{{ '/architecture/' | relative_url }}">→ Architecture &amp; data flow</a> ·
<a href="{{ '/metrics/' | relative_url }}">→ Metrics guide</a></p>

</article>
