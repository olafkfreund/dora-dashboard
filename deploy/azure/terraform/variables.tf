########################################
# Naming & location
########################################
variable "name" {
  description = "Base name / prefix for all resources (e.g. dora)."
  type        = string
  default     = "dora"
}

variable "environment" {
  description = "Environment name (e.g. dev, staging, prod) — used in the resource-group name and tags."
  type        = string
  default     = "dev"
}

variable "location" {
  description = "Azure region."
  type        = string
  default     = "westeurope"
}

variable "resource_group_name" {
  description = "Resource group to deploy into. Empty = create one named <name>-<environment>-rg."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Extra tags applied to every resource."
  type        = map(string)
  default     = {}
}

########################################
# Container image & scaling
########################################
variable "image" {
  description = "Container image (GHCR or ACR)."
  type        = string
  default     = "ghcr.io/olafkfreund/dora-dashboard:latest"
}

variable "cpu" {
  description = "vCPU per replica."
  type        = number
  default     = 0.5
}

variable "memory" {
  description = "Memory per replica (e.g. 1Gi)."
  type        = string
  default     = "1Gi"
}

variable "min_replicas" {
  description = "Minimum replicas (0 allows scale-to-zero)."
  type        = number
  default     = 1
}

variable "max_replicas" {
  description = "Maximum replicas."
  type        = number
  default     = 3
}

########################################
# Database
########################################
variable "deploy_postgres" {
  description = "Deploy a managed PostgreSQL Flexible Server. If false, set database_url."
  type        = bool
  default     = true
}

variable "postgres_sku" {
  description = "PostgreSQL Flexible Server SKU."
  type        = string
  default     = "B_Standard_B1ms"
}

variable "postgres_storage_mb" {
  description = "PostgreSQL storage in MB."
  type        = number
  default     = 32768
}

variable "postgres_admin_login" {
  description = "PostgreSQL administrator login."
  type        = string
  default     = "doraadmin"
}

variable "postgres_admin_password" {
  description = "PostgreSQL administrator password. Empty = generate one."
  type        = string
  default     = ""
  sensitive   = true
}

variable "database_url" {
  description = "External Postgres connection string (used only when deploy_postgres = false)."
  type        = string
  default     = ""
  sensitive   = true
}

########################################
# App secrets
########################################
variable "auth_secret" {
  description = "Auth.js session secret. Empty = generate one."
  type        = string
  default     = ""
  sensitive   = true
}

variable "app_encryption_key" {
  description = "App token-encryption key (32-byte base64). Empty = generate one."
  type        = string
  default     = ""
  sensitive   = true
}

variable "admin_email" {
  description = "Bootstrap admin email."
  type        = string
  default     = "admin@dora.local"
}
