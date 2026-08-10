# Deploy to Azure

Run the DORA Dashboard as a managed container on Azure — **no Kubernetes required**. Two
supported paths: **Azure Container Apps** (recommended) and **Azure App Service** (Web App
for Containers, with sidecars). Both ship as ready-to-use **Bicep** templates, and Container
Apps also ships a **Terraform** module. Helm/AKS remains available for teams that require
Kubernetes (see [Deployment](deployment.md)).

Managed TLS, patching, scaling and identity are handled for you. You get enterprise
security — Key Vault, Managed Identity, Private Endpoints, Entra ID — without running or
hardening a cluster.

## Which option?

| | Azure Container Apps *(recommended)* | Azure App Service |
| --- | --- | --- |
| Best for | Containers, autoscaling, scale-to-zero | Teams standardised on App Service |
| Ingress + TLS | Built-in, free managed certs | Built-in, free managed certs |
| Autoscale | KEDA (HTTP/CPU/queue), to zero | Plan-based scale-out |
| Sidecars | Multiple containers per app | Sidecars (GA) |
| Secrets | App secrets + Key Vault via Managed Identity | Key Vault references |
| Networking | VNet integration + Private Endpoints | VNet integration + Private Endpoints |

## Topology

```mermaid
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
```

## Prerequisites

- An Azure subscription and the **Azure CLI** (`az`) with the Bicep tools
  (`az bicep install`).
- The container image — public on GHCR (`ghcr.io/olafkfreund/dora-dashboard`) or mirrored
  into your **Azure Container Registry**.
- Two generated secrets: `AUTH_SECRET` and `APP_ENCRYPTION_KEY`
  (`openssl rand -base64 32`).

## Option A — Azure Container Apps (recommended)

Templates come in two flavours — pick whichever your team standardises on:

- **Bicep** — `deploy/azure/container-apps/`
- **Terraform** — `deploy/azure/terraform/` (with ready-made `environments/dev.tfvars` and
  `environments/prod.tfvars`)

### One-command deploy (Bicep)

```bash
cd deploy/azure/container-apps
RG=dora-rg LOCATION=westeurope ./deploy.sh
```

The script creates the resource group, generates secrets + a Postgres password, deploys the
Bicep, and prints the app URL. What the template provisions:

- Log Analytics workspace + Container Apps environment
- PostgreSQL Flexible Server (v16) + database (toggle with `deployPostgres`)
- Key Vault + user-assigned Managed Identity
- The Container App: external ingress on port 3000, managed TLS, secrets, autoscale 1–3

### Manual deploy

```bash
az group create -n dora-rg -l westeurope
az deployment group create -g dora-rg \
  -f deploy/azure/container-apps/main.bicep \
  -p authSecret="$(openssl rand -base64 32)" \
     appEncryptionKey="$(openssl rand -base64 32)" \
     postgresAdminPassword="$(openssl rand -base64 24)" \
     adminEmail="admin@yourcompany.com" \
  --query "properties.outputs.appUrl.value" -o tsv
```

Get the first-run admin password from the logs:

```bash
az containerapp logs show -g dora-rg -n dora --tail 50
```

## Option B — Azure App Service (Web App for Containers)

Templates live in `deploy/azure/app-service/`.

```bash
cd deploy/azure/app-service
RG=dora-rg LOCATION=westeurope ./deploy.sh
```

Provisions a Linux App Service Plan (P0v3 by default), the Web App (container on port 3000,
HTTPS-only, health check on `/login`), Key Vault + Managed Identity, and PostgreSQL Flexible
Server. App Service supports **multi-container sidecars** — the template includes an optional
OpenTelemetry collector sidecar (`-p enableOtelSidecar=true`); add your own as additional
`Microsoft.Web/sites/sitecontainers` resources.

## Terraform module (Container Apps)

The module is at `deploy/azure/terraform/` — `providers.tf`, `variables.tf`, `main.tf`,
`outputs.tf`, `terraform.tfvars.example`, and ready-made `environments/dev.tfvars` +
`environments/prod.tfvars`. It provisions a resource group, Log Analytics, Key Vault, a
managed identity, a PostgreSQL Flexible Server, and the Container Apps environment + app.

```bash
git clone https://github.com/olafkfreund/dora-dashboard.git
cd dora-dashboard/deploy/azure/terraform
terraform init
terraform plan  -var-file=environments/dev.tfvars
terraform apply -var-file=environments/dev.tfvars
terraform output app_url   # https://dora-dev.<region>.azurecontainerapps.io
```

A minimal per-environment file only needs a few values — everything else has sensible
defaults:

```hcl
name         = "dora"
environment  = "dev"
location     = "westeurope"
admin_email  = "admin@yourcompany.com"
min_replicas = 0        # scale-to-zero when idle
```

Leave `auth_secret`, `app_encryption_key` and `postgres_admin_password` unset and Terraform
**generates** them (kept in state) — or set them explicitly / wire Key Vault for production.

### Variables reference

| Variable | Default | Purpose |
| --- | --- | --- |
| `name` / `environment` | dora / dev | resource names + tags; RG = `<name>-<environment>-rg` |
| `location` | westeurope | Azure region |
| `resource_group_name` | "" (create) | set to deploy into an existing RG |
| `image` | ghcr.io/olafkfreund/dora-dashboard:latest | container image |
| `cpu` / `memory` | 0.5 / 1Gi | per replica |
| `min_replicas` / `max_replicas` | 1 / 3 | `min_replicas = 0` → scale-to-zero |
| `deploy_postgres` | true | false → provide `database_url` |
| `postgres_sku` | B_Standard_B1ms | e.g. `GP_Standard_D2s_v3` for prod |
| `auth_secret`, `app_encryption_key`, `postgres_admin_password` | "" (generate) | secrets — set or auto-generate |
| `admin_email` | admin@dora.local | bootstrap admin |
| `tags` | {} | extra tags on every resource |

Each environment is just another `-var-file` and its own state (a Terraform workspace or a
separate backend key). Add a new environment by dropping an `environments/<name>.tfvars`
file with the overrides you want.

## Database — PostgreSQL Flexible Server

Both Bicep and Terraform deploy a managed **Azure Database for PostgreSQL Flexible Server**
by default. To use an existing/managed DB instead:

```bash
# Bicep
-p deployPostgres=false databaseUrl="postgresql://user:pass@host:5432/dora?sslmode=require"
```

For production, disable public access on the Flexible Server and connect via **VNet
integration + a Private Endpoint** so the database is never exposed to the internet. The
bundled firewall rule (*AllowAzureServices*) is for quick starts only. Ensure the URL
includes `sslmode=require`.

## Secrets — Key Vault + Managed Identity

The app needs `DATABASE_URL`, `AUTH_SECRET` and `APP_ENCRYPTION_KEY`. For the hardened
setup:

1. Store each as a Key Vault secret.
2. Grant the app's **user-assigned Managed Identity** the *Key Vault Secrets User* role.
3. Reference them — App Service: `@Microsoft.KeyVault(SecretUri=…)` app settings; Container
   Apps: secrets with `keyVaultUrl` + `identity`.

Integration tokens (GitLab/Jira) and SSO client secrets are additionally encrypted by the
app with **AES-256-GCM** before they are stored in the database.

## TLS and custom domain

Both services provide a default HTTPS hostname with a managed certificate. For a custom
domain:

```bash
# Container Apps
az containerapp hostname add  -g dora-rg -n dora --hostname dora.yourcompany.com
az containerapp hostname bind -g dora-rg -n dora --hostname dora.yourcompany.com --environment dora-env

# App Service
az webapp config hostname add -g dora-rg --webapp-name dora --hostname dora.yourcompany.com
az webapp config ssl create   -g dora-rg --name dora --hostname dora.yourcompany.com  # managed cert
```

## Scaling

- **Container Apps** — HTTP autoscale (KEDA); tune `minReplicas`/`maxReplicas` and the
  concurrent-requests rule. Can scale to zero for dev.
- **App Service** — scale up (plan SKU) and out (instances / autoscale rules).

## CI/CD to Azure (GitHub Actions)

Use OIDC federation (no stored credentials):

```yaml
- uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
- run: |
    az containerapp update -g dora-rg -n dora \
      --image ghcr.io/olafkfreund/dora-dashboard:${{ github.sha }}
```

## Security checklist (Azure)

- HTTPS-only + managed TLS (both services enforce it)
- Secrets in **Key Vault**, read via **Managed Identity** — none in config/image
- PostgreSQL **public access disabled** + Private Endpoint
- Managed Identity for ACR pull and Key Vault (no infra passwords)
- **Microsoft Defender for Containers** for image/runtime scanning
- Diagnostic logs → **Azure Monitor / Log Analytics**; audit log retained
- Optional: App Service **Easy Auth** or Entra ID in front; restrict inbound with access
  restrictions / Front Door WAF

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| App won't start / port | Container listens on **3000** — Container Apps `targetPort: 3000`; App Service `WEBSITES_PORT=3000`. |
| Image pull fails (ACR) | Grant the Managed Identity *AcrPull* on the registry. |
| DB connection refused | Check the Flexible Server firewall/Private Endpoint and that `sslmode=require` is in the URL. |
| Key Vault reference empty | Managed Identity needs *Key Vault Secrets User*; RBAC can take a minute to propagate. |
| Role assignment fails (Terraform) | You need *User Access Administrator* (or Owner) to create the Key Vault role assignment. |
| Can't sign in | Read the first-run admin password from logs; set the Entra redirect URI to the app's HTTPS host. |

See [Configuration](configuration.md) for connecting GitLab, Jira, and Entra ID SSO, and
[Security](security.md) for the full posture.
