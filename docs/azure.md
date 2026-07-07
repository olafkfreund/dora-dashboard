---
layout: default
title: Deploy to Azure · DORA Dashboard
description: Deploy the portal on Azure Container Apps or Azure App Service with Bicep — managed TLS, Key Vault, Managed Identity, and a private PostgreSQL Flexible Server. No Kubernetes required.
---

<article class="doc" markdown="1">

<p class="eyebrow">Documentation</p>

# Deploy to Azure

<p class="lead">
Run the DORA Dashboard as a managed container on Azure — <strong>no Kubernetes required</strong>.
Two supported paths: <strong>Azure Container Apps</strong> (recommended) and <strong>Azure App
Service</strong> (Web App for Containers, with sidecars). Both ship as ready-to-use
<strong>Bicep</strong> templates.
</p>

<div class="note"><strong>Why Azure PaaS?</strong> Managed TLS, patching, scaling and identity are
handled for you. You get enterprise security (Key Vault, Managed Identity, Private Endpoints,
Entra ID) without running or hardening a cluster. Helm/AKS remains available for teams that
require Kubernetes.</div>

## Which option?

<div class="table-wrap" markdown="0">
<table>
<thead><tr><th></th><th>Azure Container Apps <em>(recommended)</em></th><th>Azure App Service</th></tr></thead>
<tbody>
<tr><td>Best for</td><td>Containers, autoscaling, scale-to-zero</td><td>Teams standardised on App Service</td></tr>
<tr><td>Ingress + TLS</td><td>Built-in, free managed certs</td><td>Built-in, free managed certs</td></tr>
<tr><td>Autoscale</td><td>KEDA (HTTP/CPU/queue), to zero</td><td>Plan-based scale-out</td></tr>
<tr><td>Sidecars</td><td>Multiple containers per app</td><td>Sidecars (GA)</td></tr>
<tr><td>Secrets</td><td>App secrets + Key Vault via Managed Identity</td><td>Key Vault references</td></tr>
<tr><td>Networking</td><td>VNet integration + Private Endpoints</td><td>VNet integration + Private Endpoints</td></tr>
</tbody>
</table>
</div>

## Topology

{% raw %}
<pre class="mermaid">
flowchart LR
  U["User (browser)"]
  subgraph AZ["Azure (your subscription)"]
    subgraph APP["Container Apps / App Service"]
      C["DORA Dashboard container - managed TLS + Managed Identity"]
    end
    KV["Key Vault - secrets"]
    PG[("PostgreSQL Flexible Server - Private Endpoint")]
    MON["Azure Monitor / Log Analytics"]
    ACR["Container Registry (ACR or GHCR)"]
  end
  GL["GitLab / Jira (read-only)"]
  U -->|HTTPS| C
  C -->|Managed Identity| KV
  C -->|private VNet| PG
  C -->|logs + metrics| MON
  ACR -->|image pull via Managed Identity| C
  C -->|outbound read| GL
</pre>
{% endraw %}

## Prerequisites

<ul>
<li>An Azure subscription and the <strong>Azure CLI</strong> (<code>az</code>) with the Bicep tools (<code>az bicep install</code>).</li>
<li>The container image — public on GHCR (<code>ghcr.io/olafkfreund/dora-dashboard</code>) or mirrored into your <strong>Azure Container Registry</strong>.</li>
<li>Two generated secrets: <code>AUTH_SECRET</code> and <code>APP_ENCRYPTION_KEY</code> (<code>openssl rand -base64 32</code>).</li>
</ul>

## Option A — Azure Container Apps (recommended)

Templates live in <code>deploy/azure/container-apps/</code>.

### One-command deploy

<pre><code>cd deploy/azure/container-apps
RG=dora-rg LOCATION=westeurope ./deploy.sh</code></pre>

The script creates the resource group, generates secrets + a Postgres password, deploys the Bicep,
and prints the app URL. What the template provisions:

<ul>
<li>Log Analytics workspace + Container Apps environment</li>
<li>PostgreSQL Flexible Server (v16) + database (toggle with <code>deployPostgres</code>)</li>
<li>Key Vault + user-assigned Managed Identity</li>
<li>The Container App: external ingress on port 3000, managed TLS, secrets, autoscale 1–3</li>
</ul>

### Manual deploy

<pre><code>az group create -n dora-rg -l westeurope
az deployment group create -g dora-rg \
  -f deploy/azure/container-apps/main.bicep \
  -p authSecret="$(openssl rand -base64 32)" \
     appEncryptionKey="$(openssl rand -base64 32)" \
     postgresAdminPassword="$(openssl rand -base64 24)" \
     adminEmail="admin@yourcompany.com" \
  --query "properties.outputs.appUrl.value" -o tsv</code></pre>

<p>Get the first-run admin password from the logs:</p>
<pre><code>az containerapp logs show -g dora-rg -n dora --tail 50</code></pre>

## Option B — Azure App Service (Web App for Containers)

Templates live in <code>deploy/azure/app-service/</code>.

<pre><code>cd deploy/azure/app-service
RG=dora-rg LOCATION=westeurope ./deploy.sh</code></pre>

Provisions a Linux App Service Plan (P0v3 by default), the Web App (container on port 3000, HTTPS-only,
health check on <code>/login</code>), Key Vault + Managed Identity, and PostgreSQL Flexible Server.

### Sidecars

App Service supports **multi-container sidecars**. The template includes an optional OpenTelemetry
collector sidecar — enable it with <code>-p enableOtelSidecar=true</code>. Add your own sidecars
(caching, proxies, agents) as additional <code>Microsoft.Web/sites/sitecontainers</code> resources.

## Database — PostgreSQL Flexible Server

Both templates deploy a managed **Azure Database for PostgreSQL Flexible Server** by default.
To use an existing/managed DB instead:

<pre><code>-p deployPostgres=false databaseUrl="postgresql://user:pass@host:5432/dora?sslmode=require"</code></pre>

<div class="tip"><strong>Production networking.</strong> Disable public access on the Flexible
Server and connect via <strong>VNet integration + a Private Endpoint</strong> so the database is
never exposed to the internet. The bundled firewall rule (<em>AllowAzureServices</em>) is for quick
starts only.</div>

## Secrets — Key Vault + Managed Identity

The app needs `DATABASE_URL`, `AUTH_SECRET` and `APP_ENCRYPTION_KEY`. For the hardened setup:

<ol>
<li>Store each as a Key Vault secret.</li>
<li>Grant the app’s <strong>user-assigned Managed Identity</strong> the <em>Key Vault Secrets User</em> role.</li>
<li>Reference them — App Service: <code>@Microsoft.KeyVault(SecretUri=…)</code> app settings; Container Apps: secrets with <code>keyVaultUrl</code> + <code>identity</code>.</li>
</ol>

<p>Integration tokens (GitLab/Jira) and SSO client secrets are additionally encrypted by the app
with <strong>AES-256-GCM</strong> before they are stored in the database.</p>

## TLS &amp; custom domain

Both services provide a default HTTPS hostname with a managed certificate. For a custom domain:

<pre><code># Container Apps
az containerapp hostname add -g dora-rg -n dora --hostname dora.yourcompany.com
az containerapp hostname bind -g dora-rg -n dora --hostname dora.yourcompany.com --environment dora-env

# App Service
az webapp config hostname add -g dora-rg --webapp-name dora --hostname dora.yourcompany.com
az webapp config ssl create -g dora-rg --name dora --hostname dora.yourcompany.com  # managed cert</code></pre>

## Scaling

- **Container Apps** — HTTP autoscale (KEDA); tune <code>minReplicas</code>/<code>maxReplicas</code> and the concurrent-requests rule. Can scale to zero for dev.
- **App Service** — scale up (plan SKU) and out (instances / autoscale rules).

## CI/CD to Azure (GitHub Actions)

Use OIDC federation (no stored credentials):

<pre><code>- uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
- run: |
    az containerapp update -g dora-rg -n dora \
      --image ghcr.io/olafkfreund/dora-dashboard:${{ github.sha }}</code></pre>

## Security checklist (Azure)

<ul>
<li>HTTPS-only + managed TLS (both services enforce it)</li>
<li>Secrets in <strong>Key Vault</strong>, read via <strong>Managed Identity</strong> — none in config/image</li>
<li>PostgreSQL <strong>public access disabled</strong> + Private Endpoint</li>
<li>Managed Identity for ACR pull and Key Vault (no infra passwords)</li>
<li><strong>Microsoft Defender for Containers</strong> for image/runtime scanning</li>
<li>Diagnostic logs → <strong>Azure Monitor / Log Analytics</strong>; audit log retained</li>
<li>Optional: App Service <strong>Easy Auth</strong> or Entra ID in front; restrict inbound with access restrictions / Front Door WAF</li>
</ul>

## Troubleshooting

<div class="table-wrap" markdown="0">
<table>
<thead><tr><th>Symptom</th><th>Fix</th></tr></thead>
<tbody>
<tr><td>App won’t start / port</td><td>Container listens on <strong>3000</strong> — Container Apps <code>targetPort: 3000</code>; App Service <code>WEBSITES_PORT=3000</code>.</td></tr>
<tr><td>Image pull fails (ACR)</td><td>Grant the Managed Identity <em>AcrPull</em> on the registry.</td></tr>
<tr><td>DB connection refused</td><td>Check the Flexible Server firewall/Private Endpoint and that <code>sslmode=require</code> is in the URL.</td></tr>
<tr><td>Key Vault reference empty</td><td>Managed Identity needs <em>Key Vault Secrets User</em>; RBAC can take a minute to propagate.</td></tr>
<tr><td>Can’t sign in</td><td>Read the first-run admin password from logs; set the Entra redirect URI to the app’s HTTPS host.</td></tr>
</tbody>
</table>
</div>

<p><a href="{{ '/architecture/' | relative_url }}">→ Architecture &amp; security</a> ·
<a href="{{ '/install/' | relative_url }}">→ Kubernetes / Helm</a> ·
<a href="{{ '/metrics/' | relative_url }}">→ Metrics guide</a></p>

</article>
