targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment that can be used as part of naming resource convention, the name of the resource group for your application will use this name, prefixed with rg-')
param environmentName string

@minLength(1)
@description('The location used for all deployed resources')
param location string

@description('Id of the user or app to assign application roles')
param principalId string = ''


var tags = {
  'azd-env-name': environmentName
}

resource rg 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

module api_identity 'api-identity/api-identity.module.bicep' = {
  name: 'api-identity'
  scope: rg
  params: {
    location: location
  }
}
module api_roles_cosmos_db 'api-roles-cosmos-db/api-roles-cosmos-db.module.bicep' = {
  name: 'api-roles-cosmos-db'
  scope: rg
  params: {
    cosmos_db_outputs_name: cosmos_db.outputs.name
    location: location
    principalId: api_identity.outputs.principalId
  }
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
    env_acr_outputs_name: env_acr.outputs.name
    location: location
    userPrincipalId: principalId
  }
}
module env_acr 'env-acr/env-acr.module.bicep' = {
  name: 'env-acr'
  scope: rg
  params: {
    location: location
  }
}
module swa 'app/swa.bicep' = {
  name: 'swa'
  scope: rg
  params: {
    location: location
    appName: 'stapp-${environmentName}'
    tags: tags
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

output API_IDENTITY_CLIENTID string = api_identity.outputs.clientId
output API_IDENTITY_ID string = api_identity.outputs.id
output AZURE_CONTAINER_APPS_ENVIRONMENT_DEFAULT_DOMAIN string = env.outputs.AZURE_CONTAINER_APPS_ENVIRONMENT_DEFAULT_DOMAIN
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = env.outputs.AZURE_CONTAINER_REGISTRY_ENDPOINT
output AZURE_STATIC_WEB_APP_HOSTNAME string = swa.outputs.defaultHostname
output AZURE_STATIC_WEB_APP_NAME string = swa.outputs.name
output COSMOS_DB_CONNECTIONSTRING string = cosmos_db.outputs.connectionString
output ENV_AZURE_CONTAINER_APPS_ENVIRONMENT_DEFAULT_DOMAIN string = env.outputs.AZURE_CONTAINER_APPS_ENVIRONMENT_DEFAULT_DOMAIN
output ENV_AZURE_CONTAINER_APPS_ENVIRONMENT_ID string = env.outputs.AZURE_CONTAINER_APPS_ENVIRONMENT_ID
output ENV_AZURE_CONTAINER_REGISTRY_ENDPOINT string = env.outputs.AZURE_CONTAINER_REGISTRY_ENDPOINT
output ENV_AZURE_CONTAINER_REGISTRY_MANAGED_IDENTITY_ID string = env.outputs.AZURE_CONTAINER_REGISTRY_MANAGED_IDENTITY_ID
