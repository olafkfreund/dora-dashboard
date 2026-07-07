# DORA Dashboard — Azure Container Apps (Terraform)

Provisions the portal on **Azure Container Apps** with a managed **PostgreSQL Flexible Server**,
**Key Vault**, **Log Analytics**, and a **user-assigned managed identity** — with variables designed
to be easy to set per environment.

## Layout

| File | Purpose |
|---|---|
| `providers.tf` | azurerm + random providers (remote-backend stub included) |
| `variables.tf` | all inputs, with defaults and descriptions |
| `main.tf` | resources (RG, Log Analytics, Key Vault, identity, Postgres, ACA env + app) |
| `outputs.tf` | app URL, resource group, Postgres FQDN, Key Vault, identity client id |
| `terraform.tfvars.example` | copy to `terraform.tfvars` and edit |
| `environments/dev.tfvars`, `environments/prod.tfvars` | ready-made per-env value files |

## Quick start

```bash
az login
cd deploy/azure/terraform
terraform init

# Dev (scale-to-zero, small DB)
terraform apply -var-file=environments/dev.tfvars

# Prod (always-warm, larger DB)
terraform apply -var-file=environments/prod.tfvars

terraform output app_url
```

Secrets left empty (`auth_secret`, `app_encryption_key`, `postgres_admin_password`) are
**auto-generated** and kept in Terraform state — set them explicitly (or wire Key Vault) for
production. The first-run admin password is printed by the app on startup:

```bash
az containerapp logs show -g "$(terraform output -raw resource_group)" -n dora-<env> --tail 50
```

## Adding a new environment

Create `environments/<name>.tfvars`, set at least `environment` and any sizing/secret overrides,
then `terraform apply -var-file=environments/<name>.tfvars`. Use a separate state (workspace or
backend `key`) per environment.

## Key variables

| Variable | Default | Notes |
|---|---|---|
| `name` / `environment` | `dora` / `dev` | names + tags |
| `location` | `westeurope` | Azure region |
| `image` | `ghcr.io/olafkfreund/dora-dashboard:latest` | container image |
| `cpu` / `memory` | `0.5` / `1Gi` | per replica |
| `min_replicas` / `max_replicas` | `1` / `3` | `min_replicas = 0` allows scale-to-zero |
| `deploy_postgres` | `true` | set `false` + `database_url` for an existing DB |
| `postgres_sku` | `B_Standard_B1ms` | e.g. `GP_Standard_D2s_v3` for prod |
| `admin_email` | `admin@dora.local` | bootstrap admin |

## Production hardening

- Store `DATABASE_URL` / secrets in the created **Key Vault** and reference them via the managed identity, rather than Container Apps secrets in state.
- Set `public_network_access_enabled = false` on Postgres and use a delegated subnet + Private DNS zone (VNet integration).
- Configure a remote Terraform backend (see `providers.tf`).

Full guide: <https://olafkfreund.github.io/dora-dashboard/azure/>
