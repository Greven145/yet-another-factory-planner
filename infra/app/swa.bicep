param location string
param appName string
param tags object = {}

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
    allowConfigFileUpdates: false
  }
  tags: union(tags, {
    'azd-service-name': 'web'
  })
}

output defaultHostname string = staticWebApp.properties.defaultHostname
output name string = staticWebApp.name
output id string = staticWebApp.id
