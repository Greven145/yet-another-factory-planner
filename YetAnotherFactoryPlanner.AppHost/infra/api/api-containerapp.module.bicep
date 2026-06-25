@description('The location for the resource(s) to be deployed.')
param location string = resourceGroup().location

param env_outputs_azure_container_apps_environment_default_domain string

param env_outputs_azure_container_apps_environment_id string

param api_containerimage string

param api_identity_outputs_id string

param api_containerport string

param cosmos_db_outputs_connectionstring string

param api_identity_outputs_clientid string

param env_outputs_azure_container_registry_endpoint string

param env_outputs_azure_container_registry_managed_identity_id string

param env_outputs_applicationinsights_connection_string string

resource api 'Microsoft.App/containerApps@2025-02-02-preview' = {
  name: 'api'
  location: location
  properties: {
    configuration: {
      // Multiple-revision mode enables blue-green deployments: each deploy creates a new
      // revision and traffic is shifted from blue→green after smoke tests pass.
      activeRevisionsMode: 'Multiple'
      // Cap retained inactive revisions so historic blue-green revisions don't pile up.
      maxInactiveRevisions: 5
      ingress: {
        external: true
        targetPort: int(api_containerport)
        transport: 'http'
        // Pin traffic to the "blue" label instead of latestRevision. Without this block,
        // ACA defaults to routing 100% to the newest revision, so every deploy would serve
        // un-smoke-tested code immediately. "blue" is a stable alias for the current
        // production revision; scripts/aca-bluegreen.sh moves it to green only after smoke
        // passes, and `ensure-blue` bootstraps it before the first provision.
        traffic: [
          {
            label: 'blue'
            weight: 100
          }
        ]
      }
      registries: [
        {
          server: env_outputs_azure_container_registry_endpoint
          identity: env_outputs_azure_container_registry_managed_identity_id
        }
      ]
      runtime: {
        dotnet: {
          autoConfigureDataProtection: true
        }
      }
    }
    environmentId: env_outputs_azure_container_apps_environment_id
    template: {
      containers: [
        {
          image: api_containerimage
          name: 'api'
          env: [
            {
              name: 'OTEL_DOTNET_EXPERIMENTAL_OTLP_RETRY'
              value: 'in_memory'
            }
            {
              name: 'ASPNETCORE_FORWARDEDHEADERS_ENABLED'
              value: 'true'
            }
            {
              name: 'HTTP_PORTS'
              value: api_containerport
            }
            {
              name: 'ConnectionStrings__cosmos-db'
              value: cosmos_db_outputs_connectionstring
            }
            {
              name: 'COSMOS_DB_URI'
              value: cosmos_db_outputs_connectionstring
            }
            {
              name: 'AZURE_CLIENT_ID'
              value: api_identity_outputs_clientid
            }
            {
              name: 'AZURE_TOKEN_CREDENTIALS'
              value: 'ManagedIdentityCredential'
            }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              value: env_outputs_applicationinsights_connection_string
            }
            {
              name: 'AllowedOrigins__0'
              value: 'https://yafp.game.gottselig.ca'
            }
          ]
          // ACA health probes. Cold start is ~27s (measured), so the startup probe
          // gives a 60s window (6 failures × 10s period) before ACA gives up.
          //
          // Startup  → GET /alive — blocks liveness/readiness until the app is up.
          // Liveness → GET /alive — restarts the container if the app is hung.
          // Readiness → GET /health — pulls the replica from the ingress pool when
          //             Cosmos is unreachable (GET /health runs the "cosmos" check
          //             tagged "ready" in addition to the "self" liveness check).
          probes: [
            {
              type: 'Startup'
              httpGet: {
                path: '/alive'
                port: int(api_containerport)
                scheme: 'HTTP'
              }
              initialDelaySeconds: 5
              periodSeconds: 10
              failureThreshold: 6
              timeoutSeconds: 5
            }
            {
              type: 'Liveness'
              httpGet: {
                path: '/alive'
                port: int(api_containerport)
                scheme: 'HTTP'
              }
              periodSeconds: 30
              failureThreshold: 3
              timeoutSeconds: 5
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: int(api_containerport)
                scheme: 'HTTP'
              }
              periodSeconds: 10
              failureThreshold: 3
              timeoutSeconds: 5
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
      }
    }
  }
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${api_identity_outputs_id}': { }
      '${env_outputs_azure_container_registry_managed_identity_id}': { }
    }
  }
}
