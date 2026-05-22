param swaName string

resource staticWebApp 'Microsoft.Web/staticSites@2024-11-01' existing = {
  name: swaName
}

resource customDomain 'Microsoft.Web/staticSites/customDomains@2024-11-01' = {
  parent: staticWebApp
  name: 'yafp.game.gottselig.ca'
  properties: {
    validationMethod: 'cname-delegation'
  }
}
