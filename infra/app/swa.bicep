param location string
param appName string
param tags object = {}

@description('Key-based Cosmos DB connection string (AccountEndpoint=…;AccountKey=…). Surfaces to the managed functions runtime as the ConnectionStrings__cosmos-db env var, read by AddAzureCosmosClient("cosmos-db").')
@secure()
param cosmosConnectionString string

@description('Application Insights connection string for functions/SWA telemetry (APPLICATIONINSIGHTS_CONNECTION_STRING).')
@secure()
param appInsightsConnectionString string

resource staticWebApp 'Microsoft.Web/staticSites@2024-11-01' = {
  name: appName
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    provider: 'Custom'
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
  }
  tags: union(tags, {
    'azd-service-name': 'web'
  })
}

// App settings for the SWA-hosted managed functions. These surface to the isolated worker as
// environment variables. `ConnectionStrings__cosmos-db` (double-underscore) maps to config key
// `ConnectionStrings:cosmos-db`, which the functions' AddAzureCosmosClient("cosmos-db") reads for
// key-based Cosmos auth. `APPLICATIONINSIGHTS_CONNECTION_STRING` wires the Functions host's built-in
// App Insights telemetry. Name MUST be literally 'appsettings' (managed functions); 'functionappsettings'
// is only for bring-your-own-functions.
resource staticWebAppSettings 'Microsoft.Web/staticSites/config@2024-11-01' = {
  name: 'appsettings'
  parent: staticWebApp
  properties: {
    'ConnectionStrings__cosmos-db': cosmosConnectionString
    APPLICATIONINSIGHTS_CONNECTION_STRING: appInsightsConnectionString
  }
}

output defaultHostname string = staticWebApp.properties.defaultHostname
output name string = staticWebApp.name
output id string = staticWebApp.id
