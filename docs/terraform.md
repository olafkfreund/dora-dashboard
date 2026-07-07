---
layout: default
title: Install with Terraform · DORA Dashboard
description: Step-by-step deployment of the portal to Azure Container Apps using the Terraform module — prerequisites, init, plan, apply, per-environment configuration, and hardening.
---

<article class="doc" markdown="1">

<p class="eyebrow">Documentation</p>

# Install with Terraform

<p class="lead">
Deploy the portal to <strong>Azure Container Apps</strong> with the bundled Terraform module —
a managed <strong>PostgreSQL Flexible Server</strong>, <strong>Key Vault</strong>,
<strong>Log Analytics</strong> and a <strong>managed identity</strong>, with variables designed to
be easy to set per environment. This is a complete, copy-paste walkthrough.
</p>

<div class="note"><strong>Where it lives.</strong> The module is in the repo at
<code>deploy/azure/terraform/</code> — <code>providers.tf</code>, <code>variables.tf</code>,
<code>main.tf</code>, <code>outputs.tf</code>, a <code>terraform.tfvars.example</code>, and ready-made
<code>environments/dev.tfvars</code> + <code>environments/prod.tfvars</code>.</div>

## What it provisions

{% raw %}
<pre class="mermaid">
flowchart LR
  U["User (browser)"]
  subgraph RG["Resource group (per environment)"]
    CA["Container App - managed TLS + Managed Identity"]
    ENV["Container Apps environment"]
    KV["Key Vault"]
    PG[("PostgreSQL Flexible Server")]
    LA["Log Analytics"]
  end
  U -->|HTTPS| CA
  CA --> ENV
  CA -->|Managed Identity| KV
  CA -->|sslmode=require| PG
  CA -->|logs + metrics| LA
</pre>
{% endraw %}

## Prerequisites

<ul>
<li><strong>Terraform</strong> ≥ 1.5 and the <strong>Azure CLI</strong> (<code>az</code>).</li>
<li>An Azure subscription and permission to create resource groups, Container Apps, PostgreSQL, Key Vault and role assignments (Contributor + User Access Administrator, or Owner).</li>
<li>The container image — public on GHCR (<code>ghcr.io/olafkfreund/dora-dashboard</code>) or mirrored into your Azure Container Registry.</li>
</ul>

## Step 1 — Sign in and pick the subscription

<pre><code>az login
az account set --subscription "&lt;your-subscription-id&gt;"</code></pre>

## Step 2 — Go to the module

<pre><code>git clone https://github.com/olafkfreund/dora-dashboard.git
cd dora-dashboard/deploy/azure/terraform</code></pre>

## Step 3 — Choose / create an environment file

Use a ready-made file or copy the example:

<pre><code># ready-made
cat environments/dev.tfvars

# or start from the example
cp terraform.tfvars.example my.tfvars
$EDITOR my.tfvars</code></pre>

<p>A minimal per-environment file only needs a few values — everything else has sensible defaults:</p>

<pre><code>name         = "dora"
environment  = "dev"
location     = "westeurope"
admin_email  = "admin@yourcompany.com"
min_replicas = 0        # scale-to-zero when idle</code></pre>

<div class="tip"><strong>Secrets.</strong> Leave <code>auth_secret</code>, <code>app_encryption_key</code>
and <code>postgres_admin_password</code> unset and Terraform <strong>generates</strong> them (kept in
state) — or set them explicitly / wire Key Vault for production.</div>

## Step 4 — Initialise

<pre><code>terraform init</code></pre>

Downloads the <code>azurerm</code> + <code>random</code> providers. For team use, uncomment the
<code>backend "azurerm"</code> block in <code>providers.tf</code> to store state remotely.

## Step 5 — Preview

<pre><code>terraform plan -var-file=environments/dev.tfvars</code></pre>

Review the resources to be created (resource group, Log Analytics, Key Vault, identity, Postgres,
Container Apps environment + app).

## Step 6 — Apply

<pre><code>terraform apply -var-file=environments/dev.tfvars</code></pre>

## Step 7 — Get the URL and sign in

<pre><code>terraform output app_url
# https://dora-dev.&lt;region&gt;.azurecontainerapps.io</code></pre>

<p>Read the first-run admin password from the container logs:</p>
<pre><code>az containerapp logs show \
  -g "$(terraform output -raw resource_group)" \
  -n dora-dev --tail 50</code></pre>

<p>Sign in, then finish setup in <strong>Settings</strong> (GitLab / Jira tokens) — see the
<a href="{{ '/access/' | relative_url }}">Setup checklist</a>.</p>

## Variables reference

<div class="table-wrap" markdown="0">
<table>
<thead><tr><th>Variable</th><th>Default</th><th>Purpose</th></tr></thead>
<tbody>
<tr><td><code>name</code> / <code>environment</code></td><td>dora / dev</td><td>resource names + tags; RG = <code>&lt;name&gt;-&lt;environment&gt;-rg</code></td></tr>
<tr><td><code>location</code></td><td>westeurope</td><td>Azure region</td></tr>
<tr><td><code>resource_group_name</code></td><td>"" (create)</td><td>set to deploy into an existing RG</td></tr>
<tr><td><code>image</code></td><td>ghcr.io/olafkfreund/dora-dashboard:latest</td><td>container image</td></tr>
<tr><td><code>cpu</code> / <code>memory</code></td><td>0.5 / 1Gi</td><td>per replica</td></tr>
<tr><td><code>min_replicas</code> / <code>max_replicas</code></td><td>1 / 3</td><td><code>min_replicas = 0</code> → scale-to-zero</td></tr>
<tr><td><code>deploy_postgres</code></td><td>true</td><td>false → provide <code>database_url</code></td></tr>
<tr><td><code>postgres_sku</code></td><td>B_Standard_B1ms</td><td>e.g. <code>GP_Standard_D2s_v3</code> for prod</td></tr>
<tr><td><code>auth_secret</code>, <code>app_encryption_key</code>, <code>postgres_admin_password</code></td><td>"" (generate)</td><td>secrets — set or auto-generate</td></tr>
<tr><td><code>admin_email</code></td><td>admin@dora.local</td><td>bootstrap admin</td></tr>
<tr><td><code>tags</code></td><td>{}</td><td>extra tags on every resource</td></tr>
</tbody>
</table>
</div>

## Multiple environments

Each environment is just another <code>-var-file</code> and its own state:

<pre><code># dev  (scale-to-zero, small DB)
terraform apply -var-file=environments/dev.tfvars

# prod (always-warm, larger DB)
terraform workspace new prod   # or a separate backend key
terraform apply -var-file=environments/prod.tfvars</code></pre>

Add a new environment by dropping an <code>environments/&lt;name&gt;.tfvars</code> file with the
overrides you want.

## Production hardening

<ul>
<li>Store <code>DATABASE_URL</code> / secrets in the created <strong>Key Vault</strong> and reference them via the managed identity, instead of Container Apps secrets in state.</li>
<li>Set the Postgres server to private: <code>public_network_access_enabled = false</code> + a delegated subnet and a Private DNS zone (VNet integration).</li>
<li>Configure a <strong>remote backend</strong> (Azure Storage) and encrypt/lock state.</li>
<li>Pin <code>image</code> to an immutable digest/tag; enable Microsoft Defender for Containers.</li>
</ul>

## Update &amp; destroy

<pre><code># roll out a new image
terraform apply -var-file=environments/dev.tfvars -var="image=ghcr.io/olafkfreund/dora-dashboard:&lt;sha&gt;"

# tear the environment down
terraform destroy -var-file=environments/dev.tfvars</code></pre>

## Troubleshooting

<div class="table-wrap" markdown="0">
<table>
<thead><tr><th>Symptom</th><th>Fix</th></tr></thead>
<tbody>
<tr><td>App returns 502 on first hit</td><td>Container starts on port <strong>3000</strong>; give it a few seconds, then check <code>az containerapp logs show</code>.</td></tr>
<tr><td>Role assignment fails</td><td>You need <em>User Access Administrator</em> (or Owner) to create the Key Vault role assignment.</td></tr>
<tr><td>Key Vault name conflict</td><td>The name includes a random suffix; re-run <code>apply</code> if a rare collision occurs.</td></tr>
<tr><td>DB connection refused</td><td>Ensure the URL has <code>sslmode=require</code>; for a private server, verify VNet integration.</td></tr>
</tbody>
</table>
</div>

<p><a href="{{ '/azure/' | relative_url }}">→ Azure overview (Bicep + App Service)</a> ·
<a href="{{ '/access/' | relative_url }}">→ Setup checklist</a> ·
<a href="{{ '/architecture/' | relative_url }}">→ Architecture &amp; security</a></p>

</article>
