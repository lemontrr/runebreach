targetScope = 'resourceGroup'

param location string = resourceGroup().location
param environment string
param appName string = 'runebreach-${environment}'
param administratorLogin string
@secure()
param administratorPassword string

module vnet 'modules/vnet.bicep' = {
  name: 'vnet'
  params: {
    location: location
    vnetName: '${appName}-vnet'
  }
}

module postgres 'modules/postgresql.bicep' = {
  name: 'postgres'
  params: {
    location: location
    serverName: '${appName}-pg'
    dbSubnetId: vnet.outputs.dbSubnetId
    administratorLogin: administratorLogin
    administratorPassword: administratorPassword
  }
}

module appService 'modules/appService.bicep' = {
  name: 'appService'
  params: {
    location: location
    planName: '${appName}-plan'
    appName: appName
    appSubnetId: vnet.outputs.appSubnetId
    keyVaultUri: keyVault.outputs.keyVaultUri
  }
}

module keyVault 'modules/keyVault.bicep' = {
  name: 'keyVault'
  params: {
    location: location
    keyVaultName: '${appName}-kv'
    appServicePrincipalId: appService.outputs.principalId
  }
}

output appHostname string = appService.outputs.defaultHostname
output dbFqdn string = postgres.outputs.serverFqdn
