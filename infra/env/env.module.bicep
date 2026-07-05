@description('The location for the resource(s) to be deployed.')
param location string = resourceGroup().location

param tags object = { }

// Telemetry-only module. The Azure Container Apps managed environment, the aspire-dashboard
// dotNetComponent, and the ACA diagnostic-settings export (ContainerAppConsoleLogs /
// ContainerAppSystemLogs categories) were removed with the ACA teardown — the API now runs as
// SWA managed functions. What remains is the Log Analytics workspace + Application Insights that
// the functions/SWA telemetry (APPLICATIONINSIGHTS_CONNECTION_STRING app setting) reports into.
// The module directory is still named `env` to keep the azd/main.bicep module path stable.

resource env_law 'Microsoft.OperationalInsights/workspaces@2025-02-01' = {
  name: take('envlaw-${uniqueString(resourceGroup().id)}', 63)
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    // Free 30-day retention (PerGB2018 default); anything longer bills per GB-month.
    retentionInDays: 30
    // Safety ceiling on ingestion so a runaway log loop can't blow the subscription
    // spending limit again. June averaged ~0.2 GB/day, so 1 GB/day is ~5x headroom for
    // legitimate spikes while capping worst case at ~30 GB/mo. Tune down once log levels
    // are trimmed. Note: on hitting the cap, ingestion stops for the rest of the UTC day.
    workspaceCapping: {
      dailyQuotaGb: 1
    }
  }
  tags: tags
}

resource env_appinsights 'Microsoft.Insights/components@2020-02-02' = {
  name: take('envaiz-${uniqueString(resourceGroup().id)}', 63)
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: env_law.id
  }
  tags: tags
}

output APPLICATIONINSIGHTS_CONNECTION_STRING string = env_appinsights.properties.ConnectionString

output AZURE_LOG_ANALYTICS_WORKSPACE_NAME string = env_law.name

output AZURE_LOG_ANALYTICS_WORKSPACE_ID string = env_law.id
