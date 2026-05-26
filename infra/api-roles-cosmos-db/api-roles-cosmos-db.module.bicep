@description('The location for the resource(s) to be deployed.')
param location string = resourceGroup().location

param cosmos_db_outputs_name string

param principalId string

resource cosmos_db 'Microsoft.DocumentDB/databaseAccounts@2024-08-15' existing = {
  name: cosmos_db_outputs_name
}

resource cosmos_db_roleDefinition 'Microsoft.DocumentDB/databaseAccounts/sqlRoleDefinitions@2024-08-15' existing = {
  name: '00000000-0000-0000-0000-000000000002'
  parent: cosmos_db
}

resource cosmos_db_roleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-08-15' = {
  name: guid(principalId, cosmos_db_roleDefinition.id, cosmos_db.id)
  properties: {
    principalId: principalId
    roleDefinitionId: cosmos_db_roleDefinition.id
    scope: cosmos_db.id
  }
  parent: cosmos_db
}