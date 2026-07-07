########################################
# DORA Dashboard — Azure Container Apps (Terraform)
########################################

data "azurerm_client_config" "current" {}

locals {
  create_rg = var.resource_group_name == ""
  rg_name   = local.create_rg ? "${var.name}-${var.environment}-rg" : var.resource_group_name
  tags      = merge({ app = "dora-dashboard", environment = var.environment }, var.tags)
}

# ---- Resource group (create or use existing) ----
resource "azurerm_resource_group" "rg" {
  count    = local.create_rg ? 1 : 0
  name     = local.rg_name
  location = var.location
  tags     = local.tags
}

# ---- Generated secrets (used only when the matching var is empty) ----
resource "random_password" "pg" {
  count   = var.deploy_postgres && var.postgres_admin_password == "" ? 1 : 0
  length  = 24
  special = false
}
resource "random_password" "auth" {
  count   = var.auth_secret == "" ? 1 : 0
  length  = 48
  special = false
}
resource "random_id" "enc" {
  count       = var.app_encryption_key == "" ? 1 : 0
  byte_length = 32
}
resource "random_string" "kv" {
  length  = 6
  special = false
  upper   = false
}

locals {
  pg_password  = var.deploy_postgres ? (var.postgres_admin_password != "" ? var.postgres_admin_password : random_password.pg[0].result) : ""
  auth_secret  = var.auth_secret != "" ? var.auth_secret : random_password.auth[0].result
  enc_key      = var.app_encryption_key != "" ? var.app_encryption_key : random_id.enc[0].b64_std
  pg_fqdn      = var.deploy_postgres ? azurerm_postgresql_flexible_server.pg[0].fqdn : ""
  database_url = var.deploy_postgres ? "postgresql://${var.postgres_admin_login}:${local.pg_password}@${local.pg_fqdn}:5432/dora?sslmode=require" : var.database_url
}

# ---- Observability ----
resource "azurerm_log_analytics_workspace" "logs" {
  name                = "${var.name}-${var.environment}-logs"
  location            = var.location
  resource_group_name = local.rg_name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.tags
  depends_on          = [azurerm_resource_group.rg]
}

# ---- Managed identity (ACR pull / Key Vault) ----
resource "azurerm_user_assigned_identity" "uami" {
  name                = "${var.name}-${var.environment}-id"
  location            = var.location
  resource_group_name = local.rg_name
  tags                = local.tags
  depends_on          = [azurerm_resource_group.rg]
}

# ---- Key Vault (secrets at rest) ----
resource "azurerm_key_vault" "kv" {
  name                       = substr("${var.name}${var.environment}kv${random_string.kv.result}", 0, 24)
  location                   = var.location
  resource_group_name        = local.rg_name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  rbac_authorization_enabled = true
  purge_protection_enabled   = true
  tags                       = local.tags
  depends_on                 = [azurerm_resource_group.rg]
}

resource "azurerm_role_assignment" "kv_reader" {
  scope                = azurerm_key_vault.kv.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.uami.principal_id
}

# ---- PostgreSQL Flexible Server (optional) ----
resource "azurerm_postgresql_flexible_server" "pg" {
  count                         = var.deploy_postgres ? 1 : 0
  name                          = "${var.name}-${var.environment}-pg"
  resource_group_name           = local.rg_name
  location                      = var.location
  version                       = "16"
  administrator_login           = var.postgres_admin_login
  administrator_password        = local.pg_password
  sku_name                      = var.postgres_sku
  storage_mb                    = var.postgres_storage_mb
  backup_retention_days         = 7
  public_network_access_enabled = true # quick start; for prod use delegated_subnet_id + private DNS
  zone                          = "1"
  tags                          = local.tags
  depends_on                    = [azurerm_resource_group.rg]
}

resource "azurerm_postgresql_flexible_server_database" "dora" {
  count     = var.deploy_postgres ? 1 : 0
  name      = "dora"
  server_id = azurerm_postgresql_flexible_server.pg[0].id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

resource "azurerm_postgresql_flexible_server_firewall_rule" "azure" {
  count            = var.deploy_postgres ? 1 : 0
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.pg[0].id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# ---- Container Apps environment ----
resource "azurerm_container_app_environment" "env" {
  name                       = "${var.name}-${var.environment}-env"
  location                   = var.location
  resource_group_name        = local.rg_name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.logs.id
  tags                       = local.tags
}

# ---- The Container App ----
resource "azurerm_container_app" "app" {
  name                         = "${var.name}-${var.environment}"
  container_app_environment_id = azurerm_container_app_environment.env.id
  resource_group_name          = local.rg_name
  revision_mode                = "Single"
  tags                         = local.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.uami.id]
  }

  ingress {
    external_enabled = true
    target_port      = 3000
    transport        = "auto"
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  secret {
    name  = "database-url"
    value = local.database_url
  }
  secret {
    name  = "auth-secret"
    value = local.auth_secret
  }
  secret {
    name  = "app-encryption-key"
    value = local.enc_key
  }

  template {
    min_replicas = var.min_replicas
    max_replicas = var.max_replicas

    container {
      name   = "web"
      image  = var.image
      cpu    = var.cpu
      memory = var.memory

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "AUTH_TRUST_HOST"
        value = "true"
      }
      env {
        name  = "BOOTSTRAP_ADMIN_EMAIL"
        value = var.admin_email
      }
      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }
      env {
        name        = "AUTH_SECRET"
        secret_name = "auth-secret"
      }
      env {
        name        = "APP_ENCRYPTION_KEY"
        secret_name = "app-encryption-key"
      }

      liveness_probe {
        transport     = "HTTP"
        port          = 3000
        path          = "/login"
        initial_delay = 15
      }
      readiness_probe {
        transport = "HTTP"
        port      = 3000
        path      = "/login"
      }
    }

    http_scale_rule {
      name                = "http"
      concurrent_requests = 50
    }
  }
}
