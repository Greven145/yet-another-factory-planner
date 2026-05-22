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
    disableLocalAuth: true
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

output connectionString string = cosmos_db.properties.documentEndpoint

output name string = cosmos_db.name

output id string = cosmos_db.id