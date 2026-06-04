param location string
param planName string
param appName string
param appSubnetId string
param keyVaultUri string

resource plan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: planName
  location: location
  sku: { name: 'B1', tier: 'Basic' }
  properties: { reserved: true } // Linux
}

resource app 'Microsoft.Web/sites@2023-01-01' = {
  name: appName
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      // Secrets resolved from Key Vault — no plaintext values (RISK-012)
      appSettings: [
        { name: 'NODE_ENV', value: 'production' }
        { name: 'WEBSITE_RUN_FROM_PACKAGE', value: '1' }
        {
          name: 'DATABASE_URL'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/DATABASE-URL/)'
        }
        {
          name: 'JWT_SECRET'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/JWT-SECRET/)'
        }
        {
          name: 'WEBAUTHN_RP_SECRET'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/WEBAUTHN-RP-SECRET/)'
        }
      ]
    }
    virtualNetworkSubnetId: appSubnetId
    httpsOnly: true // HTTPS only — no HTTP fallback
  }
}

output principalId string = app.identity.principalId
output defaultHostname string = app.properties.defaultHostName
