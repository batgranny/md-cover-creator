resource "azurerm_resource_group" "rg" {
  name     = "md-cover-creator-rg"
  location = "East US"
}

resource "azurerm_log_analytics_workspace" "logs" {
  name                = "md-cover-creator-logs"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_container_app_environment" "env" {
  name                       = "md-cover-creator-env"
  location                   = azurerm_resource_group.rg.location
  resource_group_name        = azurerm_resource_group.rg.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.logs.id
}

resource "azurerm_container_app" "app" {
  name                         = "md-cover-creator-app"
  container_app_environment_id = azurerm_container_app_environment.env.id
  resource_group_name          = azurerm_resource_group.rg.name
  revision_mode                = "Single"

  template {
    container {
      name   = "md-cover-creator"
      image  = "batgranny/md-cover-creator:latest"
      cpu    = 0.25
      memory = "0.5Gi"
    }
    
    min_replicas = 0
    max_replicas = 1
  }

  ingress {
    external_enabled = true
    target_port      = 8080
    traffic_weight {
      percentage = 100
      latest_revision = true
    }
  }
}

output "app_url" {
  value = azurerm_container_app.app.latest_revision_fqdn
}
