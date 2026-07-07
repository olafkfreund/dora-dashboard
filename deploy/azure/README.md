# Deploy DORA Dashboard to Azure

Two supported, Kubernetes-free deployment paths, delivered as Bicep templates.

| Path | Directory | When |
|---|---|---|
| **Azure Container Apps** (recommended) | [`container-apps/`](./container-apps) | Containers, autoscale, scale-to-zero |
| **Azure App Service** (Web App for Containers + sidecars) | [`app-service/`](./app-service) | Teams standardised on App Service |

Each folder contains `main.bicep`, `main.parameters.json`, and a `deploy.sh` helper.

## Quick start (Container Apps)

```bash
cd container-apps
RG=dora-rg LOCATION=westeurope ./deploy.sh
```

Both templates provision, by default: the compute (with managed TLS + Managed Identity), an
Azure Database for **PostgreSQL Flexible Server**, and a **Key Vault**. Provide `AUTH_SECRET`,
`APP_ENCRYPTION_KEY` and a Postgres password (the scripts generate them if unset).

Validate a template without deploying:

```bash
az bicep build -f container-apps/main.bicep
```

Full guide (TLS, custom domains, Key Vault + Managed Identity, Private Endpoints, CI/CD,
security checklist): **https://olafkfreund.github.io/dora-dashboard/azure/**

For Kubernetes/AKS instead, see the Helm chart under [`../../charts/dora-dashboard`](../../charts/dora-dashboard).
