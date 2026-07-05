targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment that can be used as part of naming resource convention, the name of the resource group for your application will use this name, prefixed with rg-')
param environmentName string

@minLength(1)
@description('The location used for all deployed resources')
param location string

var tags = {
  'azd-env-name': environmentName
}

resource rg 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

module cosmos_db 'cosmos-db/cosmos-db.module.bicep' = {
  name: 'cosmos-db'
  scope: rg
  params: {
    location: location
  }
}
module env 'env/env.module.bicep' = {
  name: 'env'
  scope: rg
  params: {
    location: location
    tags: tags
  }
}
module swa 'app/swa.bicep' = {
  name: 'swa'
  scope: rg
  params: {
    location: location
    appName: 'stapp-${environmentName}'
    tags: tags
    // Key-based Cosmos connection string + App Insights connection string flow straight into the
    // SWA managed-functions app settings; both are @secure() end-to-end so no key lands in a
    // plaintext deployment output.
    cosmosConnectionString: cosmos_db.outputs.connectionString
    appInsightsConnectionString: env.outputs.APPLICATIONINSIGHTS_CONNECTION_STRING
  }
}

module dns 'app/dns.bicep' = {
  name: 'dns'
  scope: resourceGroup('dedicated')
  params: {
    swaHostname: swa.outputs.defaultHostname
  }
}

module swaDomain 'app/swa-domain.bicep' = {
  name: 'swa-domain'
  scope: rg
  dependsOn: [dns]
  params: {
    swaName: swa.outputs.name
  }
}

// ACA teardown: the API_IDENTITY_*, AZURE_CONTAINER_APPS_ENVIRONMENT_*, ENV_APPLICATIONINSIGHTS_*
// and COSMOS_DB_CONNECTIONSTRING outputs are gone. The Cosmos connection string is now a @secure()
// value wired directly into the SWA app settings inside bicep (never a plaintext deployment output),
// and the client build uses a same-origin /api base rather than an ACA-domain lookup.
output AZURE_STATIC_WEB_APP_HOSTNAME string = swa.outputs.defaultHostname
output AZURE_STATIC_WEB_APP_NAME string = swa.outputs.name
