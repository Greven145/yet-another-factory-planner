@description('The location for the resource(s) to be deployed.')
param location string = resourceGroup().location

resource cosmos_db 'Microsoft.DocumentDB/databaseAccounts@2024-08-15' = {
  name: take('cosmosdb-${uniqueString(resourceGroup().id)}', 44)
  location: location
  properties: {
    locations: [
      {
        locationName: location
        failoverPriority: 0
      }
    ]
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    databaseAccountOfferType: 'Standard'
    // Key-based (local) auth is ENABLED for the SWA managed-functions API. SWA managed functions
    // have no managed identity and no Key Vault refs, so they authenticate to Cosmos with an
    // account key supplied via a SWA app setting (ConnectionStrings__cosmos-db). Accepted
    // security-posture trade-off: the `factories` container holds only publicly-shareable factory
    // configs with a 7-day TTL. (Was `disableLocalAuth: true` under the retired ACA managed-identity
    // setup — see infra/api-identity + infra/api-roles-cosmos-db, both deleted with ACA.)
    disableLocalAuth: false
  }
  kind: 'GlobalDocumentDB'
  tags: {
    'aspire-resource-name': 'cosmos-db'
  }
}

resource shared_factory 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-08-15' = {
  name: 'shared-factory'
  location: location
  properties: {
    resource: {
      id: 'shared-factory'
    }
  }
  parent: cosmos_db
}

resource factories 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-08-15' = {
  name: 'factories'
  location: location
  properties: {
    resource: {
      id: 'factories'
      partitionKey: {
        paths: [
          '/gameVersion'
        ]
        kind: 'Hash'
      }
      defaultTtl: 604800
    }
  }
  parent: shared_factory
}

// Key-based (AccountEndpoint=…;AccountKey=…) connection string consumed by the SWA managed
// functions' AddAzureCosmosClient("cosmos-db"). Marked @secure() so it is not logged and never
// surfaces in deployment output history; main.bicep passes it straight into the SWA app settings.
@secure()
output connectionString string = cosmos_db.listConnectionStrings().connectionStrings[0].connectionString

output name string = cosmos_db.name

output id string = cosmos_db.id