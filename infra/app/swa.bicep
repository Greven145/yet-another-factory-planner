param location string
param appName string
param tags object = {}

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
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

output defaultHostname string = staticWebApp.properties.defaultHostname
output name string = staticWebApp.name
output id string = staticWebApp.id
