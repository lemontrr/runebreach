param location string
param serverName string
param dbSubnetId string
param administratorLogin string
@secure()
param administratorPassword string

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: serverName
  location: location
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorPassword
    version: '16'
    storage: { storageSizeGB: 32 }
    backup: { backupRetentionDays: 7, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
    network: {
      delegatedSubnetResourceId: dbSubnetId
      // Private VNET integration — no public endpoint (RISK-007)
      publicNetworkAccess: 'Disabled'
    }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: postgresServer
  name: 'runebreach'
  properties: { charset: 'utf8', collation: 'en_US.utf8' }
}

output serverFqdn string = postgresServer.properties.fullyQualifiedDomainName
output databaseName string = database.name
