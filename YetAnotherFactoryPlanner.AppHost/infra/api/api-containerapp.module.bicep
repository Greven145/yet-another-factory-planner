@description('The location for the resource(s) to be deployed.')
param location string = resourceGroup().location

param env_outputs_azure_container_apps_environment_default_domain string

param env_outputs_azure_container_apps_environment_id string

param api_containerimage string

@description('Revision name to keep serving 100% of ingress traffic (the current production / "blue" revision). When empty (e.g. first/greenfield deploy), traffic falls back to latestRevision. Fed by CI from scripts/aca-bluegreen.sh current-revision.')
param api_blue_revision string = ''

param api_identity_outputs_id string

param api_containerport string

param cosmos_db_outputs_connectionstring string

param api_identity_outputs_clientid string

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
        // Keep 100% of traffic on the current production revision (api_blue_revision) so a
        // deploy that creates a new revision lands it at 0% — letting smoke tests run before
        // any traffic shift. Without an explicit traffic block, ACA resets to 100%→latest on
        // every azd apply, which would serve un-smoke-tested code immediately. ACA requires a
        // revisionName when latestRevision is false, so we pin by name (CI supplies it); on a
        // greenfield deploy the name is empty and we fall back to latestRevision.
        traffic: empty(api_blue_revision) ? [
          {
            latestRevision: true
            weight: 100
          }
        ] : [
          {
            revisionName: api_blue_revision
            weight: 100
          }
        ]
      }
      // No registries block: the API image is a PUBLIC GHCR package
      // (ghcr.io/greven145/yet-another-factory-planner/api), which ACA pulls
      // anonymously. Nothing to authenticate, so no registry credential/identity.
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
            // SWA "staging" preview environment origin. The blue-green client
            // pipeline deploys to this named preview, runs the functional smoke
            // against it, then promotes to production — so the preview must be
            // allowed to call the API or every request is CORS-blocked. This is a
            // stable per-resource hostname (SWA default name + "-staging").
            {
              name: 'AllowedOrigins__1'
              value: 'https://calm-island-0bc976c0f-staging.eastus2.7.azurestaticapps.net'
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
        // Scale to zero when idle. The app does all solving client-side, so the API sees
        // low, bursty traffic (/initialize + share/get-factory) and has no reason to hold a
        // warm replica 24/7 on the Consumption profile. Cold start (~27s) is absorbed by the
        // CosmosWarmupService + startup probe window. Trade-off: first request after idle is slow.
        minReplicas: 0
        maxReplicas: 3
      }
    }
  }
  identity: {
    type: 'UserAssigned'
    // Only the API's own identity (used for the data-plane Cosmos DB connection).
    // The ACR-pull identity is gone: the image is pulled anonymously from public GHCR.
    userAssignedIdentities: {
      '${api_identity_outputs_id}': { }
    }
  }
}
