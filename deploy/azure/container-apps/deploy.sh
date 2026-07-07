#!/usr/bin/env bash
# Deploy DORA Dashboard to Azure Container Apps.
# Usage: RG=dora-rg LOCATION=westeurope ./deploy.sh
set -euo pipefail
RG="${RG:-dora-rg}"; LOCATION="${LOCATION:-westeurope}"
AUTH_SECRET="${AUTH_SECRET:-$(openssl rand -base64 32)}"
APP_ENCRYPTION_KEY="${APP_ENCRYPTION_KEY:-$(openssl rand -base64 32)}"
PG_PW="${PG_PW:-$(openssl rand -base64 24)}"

az group create -n "$RG" -l "$LOCATION" -o none
az deployment group create -g "$RG" -f main.bicep \
  -p name=dora location="$LOCATION" \
     authSecret="$AUTH_SECRET" appEncryptionKey="$APP_ENCRYPTION_KEY" \
     postgresAdminPassword="$PG_PW" \
     "${@}" \
  --query "properties.outputs.appUrl.value" -o tsv
echo "Bootstrap admin password is generated on first run — check container logs:"
echo "  az containerapp logs show -g $RG -n dora --tail 50"
