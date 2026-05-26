param swaHostname string

resource dnsZone 'Microsoft.Network/dnsZones@2018-05-01' existing = {
  name: 'game.gottselig.ca'
}

resource yafpCname 'Microsoft.Network/dnsZones/CNAME@2018-05-01' = {
  parent: dnsZone
  name: 'yafp'
  properties: {
    TTL: 3600
    CNAMERecord: {
      cname: swaHostname
    }
  }
}
