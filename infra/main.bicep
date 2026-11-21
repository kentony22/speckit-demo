targetScope = 'resourceGroup'

@description('Azure region for the App Service and the single Cosmos DB region.')
param location string

@description('Name of the Linux App Service plan.')
param appServicePlanName string

@description('Globally unique name of the App Service web app.')
param webAppName string

@description('Globally unique name of the Cosmos DB account.')
param cosmosAccountName string

@description('Name of the Cosmos DB for NoSQL database.')
param cosmosDatabaseName string = 'task-notebook'

@description('Name of the container that stores tasks.')
param cosmosContainerName string = 'tasks'

@description('Public IPv4 address of the verifier. The rule is a single-host /32.')
param verifierIpv4 string

resource appServicePlan 'Microsoft.Web/serverfarms@2024-11-01' = {
    name: appServicePlanName
    location: location
    kind: 'linux'
    sku: {
        name: 'F1'
        tier: 'Free'
        capacity: 1
    }
    properties: {
        reserved: true
    }
}

resource webApp 'Microsoft.Web/sites@2024-11-01' = {
    name: webAppName
    location: location
    kind: 'app,linux'
    identity: {
        type: 'SystemAssigned'
    }
    properties: {
        serverFarmId: appServicePlan.id
        httpsOnly: true
        publicNetworkAccess: 'Enabled'
        siteConfig: {
            linuxFxVersion: 'JAVA|25-java25'
            ipSecurityRestrictionsDefaultAction: 'Deny'
            ipSecurityRestrictions: [
                {
                    name: 'verifier'
                    action: 'Allow'
                    priority: 100
                    ipAddress: '${verifierIpv4}/32'
                }
            ]
            scmIpSecurityRestrictionsUseMain: false
            scmIpSecurityRestrictionsDefaultAction: 'Deny'
            scmIpSecurityRestrictions: []
            appSettings: [
                { name: 'SPRING_PROFILES_ACTIVE', value: 'azure' }
                { name: 'COSMOS_ENDPOINT', value: cosmosAccount.properties.documentEndpoint }
                { name: 'COSMOS_DATABASE', value: cosmosDatabaseName }
                { name: 'COSMOS_CONTAINER', value: cosmosContainerName }
            ]
        }
    }
}

resource scmPolicy 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2024-11-01' = {
    parent: webApp
    name: 'scm'
    properties: { allow: false }
}

resource ftpPolicy 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2024-11-01' = {
    parent: webApp
    name: 'ftp'
    properties: { allow: false }
}

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' = {
    name: cosmosAccountName
    location: location
    kind: 'GlobalDocumentDB'
    properties: {
        databaseAccountOfferType: 'Standard'
        enableFreeTier: true
        disableLocalAuth: true
        capacity: {
            totalThroughputLimit: 1000
        }
        consistencyPolicy: {
            defaultConsistencyLevel: 'Session'
        }
        locations: [
            {
                locationName: location
                failoverPriority: 0
            }
        ]
    }
}

resource metadataRole 'Microsoft.DocumentDB/databaseAccounts/sqlRoleDefinitions@2024-11-15' = {
    parent: cosmosAccount
    name: guid(cosmosAccount.id, 'todo-metadata')
    properties: {
        roleName: 'To Do Metadata Reader'
        type: 'CustomRole'
        assignableScopes: [cosmosAccount.id]
        permissions: [
            { dataActions: ['Microsoft.DocumentDB/databaseAccounts/readMetadata'] }
        ]
    }
}

resource tasksRole 'Microsoft.DocumentDB/databaseAccounts/sqlRoleDefinitions@2024-11-15' = {
    parent: cosmosAccount
    name: guid(cosmosAccount.id, 'todo-tasks')
    properties: {
        roleName: 'To Do Task Read and Create'
        type: 'CustomRole'
        assignableScopes: [cosmosAccount.id]
        permissions: [
            {
                dataActions: [
                    'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/executeQuery'
                    'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/readChangeFeed'
                    'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/items/read'
                    'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/items/create'
                ]
            }
        ]
    }
}

resource metadataAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-11-15' = {
    parent: cosmosAccount
    name: guid(metadataRole.id, webApp.id)
    properties: {
        roleDefinitionId: metadataRole.id
        principalId: webApp.identity.principalId
        scope: cosmosAccount.id
    }
}

resource cosmosDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-11-15' = {
    parent: cosmosAccount
    name: cosmosDatabaseName
    properties: {
        resource: {
            id: cosmosDatabaseName
        }
    }
}

resource cosmosContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
    parent: cosmosDatabase
    name: cosmosContainerName
    properties: {
        resource: {
            id: cosmosContainerName
            partitionKey: {
                paths: [
                    '/ownerId'
                ]
                kind: 'Hash'
            }
        }
        options: {
            throughput: 400
        }
    }
}

resource tasksAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-11-15' = {
    parent: cosmosAccount
    name: guid(tasksRole.id, webApp.id, cosmosContainer.id)
    properties: {
        roleDefinitionId: tasksRole.id
        principalId: webApp.identity.principalId
        scope: '${cosmosAccount.id}/dbs/${cosmosDatabaseName}/colls/${cosmosContainerName}'
    }
}
