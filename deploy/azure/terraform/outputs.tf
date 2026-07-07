output "app_url" {
  description = "Public HTTPS URL of the portal."
  value       = "https://${azurerm_container_app.app.ingress[0].fqdn}"
}

output "resource_group" {
  description = "Resource group the app was deployed into."
  value       = local.rg_name
}

output "postgres_fqdn" {
  description = "PostgreSQL Flexible Server FQDN (empty when using an external DB)."
  value       = local.pg_fqdn
}

output "key_vault_name" {
  description = "Key Vault name (store DATABASE_URL / secrets here for the hardened setup)."
  value       = azurerm_key_vault.kv.name
}

output "identity_client_id" {
  description = "User-assigned managed identity client id (grant ACR pull / Key Vault access)."
  value       = azurerm_user_assigned_identity.uami.client_id
}
