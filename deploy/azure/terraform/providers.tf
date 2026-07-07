terraform {
  required_version = ">= 1.5"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
  # For team use, configure a remote backend, e.g.:
  # backend "azurerm" {
  #   resource_group_name  = "tfstate-rg"
  #   storage_account_name = "tfstatedora"
  #   container_name       = "tfstate"
  #   key                  = "dora.tfstate"
  # }
}

provider "azurerm" {
  features {}
}
