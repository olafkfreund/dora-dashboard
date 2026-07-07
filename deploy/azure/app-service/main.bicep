// DORA Dashboard — Azure App Service (Web App for Containers) deployment
//
// Provisions: a Linux App Service Plan, an optional PostgreSQL Flexible Server,
// a Key Vault + user-assigned managed identity, and the Web App running the
// container. App Service supports multi-container "sidecars" — an optional
// OpenTelemetry collector sidecar is included and toggled by `enableOtelSidecar`.
//
// Deploy:
//   az group create -n dora-rg -l westeurope
//   az deployment group create -g dora-rg -f main.bicep -p @main.parameters.json
//
// Validate locally:  az bicep build -f main.bicep

@description('Base name for all resources.')
param name string = 'dora'
param location string = resourceGroup().location

@description('Container image (GHCR or ACR).')
param image string = 'ghcr.io/olafkfreund/dora-dashboard:latest'

@description('App Service Plan SKU (P0v3 recommended for production).')
param planSku string = 'P0v3'

@description('Deploy a managed PostgreSQL Flexible Server. If false, provide databaseUrl.')
param deployPostgres bool = true
@secure()
param databaseUrl string = ''
@secure()
param postgresAdminPassword string = ''

@secure()
param authSecret string
@secure()
param appEncryptionKey string
param adminEmail string = 'admin@dora.local'

@description('Add an OpenTelemetry collector sidecar container (demonstrates App Service sidecars).')
param enableOtelSidecar bool = false

var pgAdmin = 'doraadmin'
var pgDatabase = 'dora'
var pgHost = '${name}-pg.postgres.database.azure.com'
var effectiveDatabaseUrl = deployPostgres
  ? 'postgresql://${pgAdmin}:${postgresAdminPassword}@${pgHost}:5432/${pgDatabase}?sslmode=require'
  : databaseUrl

resource uami 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${name}-identity'
  location: location
}

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${name}-kv-${uniqueString(resourceGroup().id)}'
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    enablePurgeProtection: true
  }
}

resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = if (deployPostgres) {
  name: '${name}-pg'
  location: location
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    version: '16'
    administratorLogin: pgAdmin
    administratorLoginPassword: postgresAdminPassword
    storage: { storageSizeGB: 32 }
    backup: { backupRetentionDays: 7, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
  }
}
resource pgDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = if (deployPostgres) {
  parent: pg
  name: pgDatabase
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}
resource pgFirewall 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = if (deployPostgres) {
  parent: pg
  name: 'AllowAzureServices'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${name}-plan'
  location: location
  sku: { name: planSku }
  kind: 'linux'
  properties: { reserved: true }
}

resource site 'Microsoft.Web/sites@2023-12-01' = {
  name: name
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${uami.id}': {} }
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    keyVaultReferenceIdentity: uami.id
    siteConfig: {
      linuxFxVersion: 'DOCKER|${image}'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      alwaysOn: true
      healthCheckPath: '/login'
      appSettings: [
        { name: 'WEBSITES_PORT', value: '3000' }
        { name: 'NODE_ENV', value: 'production' }
        { name: 'AUTH_TRUST_HOST', value: 'true' }
        { name: 'BOOTSTRAP_ADMIN_EMAIL', value: adminEmail }
        { name: 'DATABASE_URL', value: effectiveDatabaseUrl }
        { name: 'AUTH_SECRET', value: authSecret }
        { name: 'APP_ENCRYPTION_KEY', value: appEncryptionKey }
      ]
    }
  }
}

// Optional OpenTelemetry collector sidecar (App Service multi-container / sitecontainers).
resource otelSidecar 'Microsoft.Web/sites/sitecontainers@2023-12-01' = if (enableOtelSidecar) {
  parent: site
  name: 'otel-collector'
  properties: {
    image: 'otel/opentelemetry-collector-contrib:latest'
    targetPort: '4317'
    isMain: false
  }
}

output appUrl string = 'https://${site.properties.defaultHostName}'
output identityClientId string = uami.properties.clientId
output keyVaultName string = kv.name
