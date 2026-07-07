// DORA Dashboard — Azure Container Apps deployment
//
// Provisions: Log Analytics, a Container Apps environment, an optional Azure
// Database for PostgreSQL Flexible Server, a Key Vault (secrets), a user-assigned
// managed identity, and the Container App itself (external ingress + managed TLS).
//
// Deploy:
//   az group create -n dora-rg -l westeurope
//   az deployment group create -g dora-rg -f main.bicep -p @main.parameters.json
//
// Validate locally:  az bicep build -f main.bicep

@description('Base name for all resources.')
param name string = 'dora'

@description('Location for all resources.')
param location string = resourceGroup().location

@description('Container image (GHCR or ACR).')
param image string = 'ghcr.io/olafkfreund/dora-dashboard:latest'

@description('Deploy a managed PostgreSQL Flexible Server. If false, provide databaseUrl.')
param deployPostgres bool = true

@description('External Postgres connection string (used only when deployPostgres = false).')
@secure()
param databaseUrl string = ''

@description('PostgreSQL administrator password (used when deployPostgres = true).')
@secure()
param postgresAdminPassword string = ''

@description('Auth.js session secret (openssl rand -base64 32).')
@secure()
param authSecret string

@description('App token-encryption key, 32-byte base64 (openssl rand -base64 32).')
@secure()
param appEncryptionKey string

@description('Bootstrap admin email.')
param adminEmail string = 'admin@dora.local'

@description('Min / max replicas.')
param minReplicas int = 1
param maxReplicas int = 3

var pgAdmin = 'doraadmin'
var pgDatabase = 'dora'
var pgHost = '${name}-pg.postgres.database.azure.com'
var effectiveDatabaseUrl = deployPostgres
  ? 'postgresql://${pgAdmin}:${postgresAdminPassword}@${pgHost}:5432/${pgDatabase}?sslmode=require'
  : databaseUrl

// ---- Observability ----
resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${name}-logs'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// ---- Managed identity (for ACR pull / Key Vault) ----
resource uami 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${name}-identity'
  location: location
}

// ---- Key Vault (secrets at rest) ----
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

// ---- PostgreSQL Flexible Server (optional, private-capable) ----
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

// Allow Azure services (Container Apps) to reach the DB. For production, prefer
// VNet integration + a Private Endpoint instead of this rule.
resource pgFirewall 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = if (deployPostgres) {
  parent: pg
  name: 'AllowAzureServices'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
}

// ---- Container Apps environment ----
resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${name}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

// ---- The Container App ----
resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${uami.id}': {} }
  }
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        allowInsecure: false
      }
      secrets: [
        { name: 'database-url', value: effectiveDatabaseUrl }
        { name: 'auth-secret', value: authSecret }
        { name: 'app-encryption-key', value: appEncryptionKey }
      ]
    }
    template: {
      containers: [
        {
          name: 'web'
          image: image
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'AUTH_SECRET', secretRef: 'auth-secret' }
            { name: 'APP_ENCRYPTION_KEY', secretRef: 'app-encryption-key' }
            { name: 'BOOTSTRAP_ADMIN_EMAIL', value: adminEmail }
            { name: 'AUTH_TRUST_HOST', value: 'true' }
          ]
          probes: [
            { type: 'Liveness', httpGet: { path: '/login', port: 3000 }, initialDelaySeconds: 15, periodSeconds: 20 }
            { type: 'Readiness', httpGet: { path: '/login', port: 3000 }, initialDelaySeconds: 10, periodSeconds: 10 }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          { name: 'http', http: { metadata: { concurrentRequests: '50' } } }
        ]
      }
    }
  }
}

output appUrl string = 'https://${app.properties.configuration.ingress.fqdn}'
output keyVaultName string = kv.name
output identityClientId string = uami.properties.clientId
