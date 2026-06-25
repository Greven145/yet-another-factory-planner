using Azure.Provisioning.AppContainers;
using Azure.Provisioning.CosmosDB;

var builder = DistributedApplication.CreateBuilder(args);

builder.AddAzureContainerAppEnvironment("env");

#pragma warning disable ASPIRECOSMOSDB001
var cosmosDb = builder.AddAzureCosmosDB("cosmos-db")
    .RunAsPreviewEmulator(emulator =>
    {
        emulator.WithDataExplorer();

        // Skip data volume in the Testing environment: a data volume left over from
        // a previous (unclean) shutdown puts the Cosmos emulator into crash-recovery mode,
        // causing startup to take several minutes instead of ~6 seconds.
        // Fresh containers initialise from scratch and are fast.
        if (!string.Equals(builder.Environment.EnvironmentName, "Testing", StringComparison.OrdinalIgnoreCase))
        {
            emulator.WithDataVolume();
        }
    });
var db = cosmosDb.AddCosmosDatabase("shared-factory");
var container = db.AddContainer("factories", "/gameVersion");
cosmosDb.ConfigureInfrastructure(infra =>
{
    // Set 7-day TTL on the factories container so stale shared plans are auto-expired.
    // cosmosDb is the account-level AzureProvisioningResource; its infra contains all child resources.
    foreach (var sqlContainer in infra.GetProvisionableResources().OfType<CosmosDBSqlContainer>())
    {
        sqlContainer.Resource.DefaultTtl = 604800;
    }
});
#pragma warning restore ASPIRECOSMOSDB001

// Add ASP.NET Core Web API project
var api = builder.AddProject<Projects.api_web>("api")
    .WithHttpEndpoint()
    .WithExternalHttpEndpoints()
    .WithReference(cosmosDb)
    .WaitFor(cosmosDb);

api.PublishAsAzureContainerApp((infra, containerApp) =>
{
    containerApp.Template.Scale.MinReplicas = 1; // keep one warm replica: scale-to-zero measured ~27s cold starts
    containerApp.Template.Scale.MaxReplicas = 3;

    // Multiple-revision mode is required for blue-green deployments: each deploy creates a new
    // revision and traffic is shifted from blue→green after smoke tests pass.
    containerApp.Configuration.ActiveRevisionsMode = ContainerAppActiveRevisionsMode.Multiple;

    // Cap retained inactive revisions so historic blue-green revisions don't pile up.
    containerApp.Configuration.MaxInactiveRevisions = 5;

    // NOTE: ingress traffic is managed in the committed bicep
    // (infra/api/api-containerapp.module.bicep), NOT here. ACA/ARM rejects a traffic
    // weight that has no revisionName and latestRevision=false, so a stable blue-green
    // pin can only be expressed by revisionName — which changes every deploy and so must
    // be a deployment parameter (api_blue_revision), fed by CI. Azure.Provisioning can't
    // cleanly express the "empty -> latestRevision, else revisionName" guard, so the
    // traffic block lives in the committed bicep. If this AppHost is ever re-synthesized
    // (`azd infra synth`), re-apply that traffic block by hand (same dual-maintenance note
    // as the probes/revision-mode config).

    // ACA health probes. Cold start is ~27s (measured, see scale comment above), so startup
    // probe uses a long initialDelay window before the liveness/readiness probes kick in.
    //
    // Startup probe  → HTTP GET /alive every 10s, up to 6 failures (60s total budget).
    //                  Blocks liveness/readiness probes until it passes once.
    // Liveness probe → HTTP GET /alive every 30s, 3 failure threshold. Restarts the container
    //                  if the app is hung (not just slow to hit Cosmos).
    // Readiness probe → HTTP GET /health every 10s, 3 failure threshold. Pulls the replica
    //                   out of the ingress pool when Cosmos is unreachable (Unhealthy),
    //                   without restarting the container.
    // Probe target port. Must stay in sync with the container's target/listening port,
    // which is the ACA ingress targetPort (int(api_containerport), fed from the azd
    // bicepparam '{{ targetPortOrDefault 8080 }}'). 8080 is the Aspire/.NET container
    // default; if the container port ever changes, update this constant to match.
    const int ProbePort = 8080;

    var container = containerApp.Template.Containers[0].Value!;
    container.Probes.Add(new ContainerAppProbe
    {
        ProbeType = ContainerAppProbeType.Startup,
        HttpGet = new ContainerAppHttpRequestInfo
        {
            Path = "/alive",
            Port = ProbePort,
            Scheme = ContainerAppHttpScheme.Http,
        },
        InitialDelaySeconds = 5,
        PeriodSeconds = 10,
        FailureThreshold = 6,   // 60 s budget before ACA gives up and restarts
        TimeoutSeconds = 5,
    });
    container.Probes.Add(new ContainerAppProbe
    {
        ProbeType = ContainerAppProbeType.Liveness,
        HttpGet = new ContainerAppHttpRequestInfo
        {
            Path = "/alive",
            Port = ProbePort,
            Scheme = ContainerAppHttpScheme.Http,
        },
        PeriodSeconds = 30,
        FailureThreshold = 3,
        TimeoutSeconds = 5,
    });
    container.Probes.Add(new ContainerAppProbe
    {
        ProbeType = ContainerAppProbeType.Readiness,
        HttpGet = new ContainerAppHttpRequestInfo
        {
            Path = "/health",
            Port = ProbePort,
            Scheme = ContainerAppHttpScheme.Http,
        },
        PeriodSeconds = 10,
        FailureThreshold = 3,
        TimeoutSeconds = 5,
    });
});

if (builder.ExecutionContext.IsRunMode &&
    (string.Equals(builder.Environment.EnvironmentName, "Development", StringComparison.OrdinalIgnoreCase)
    || string.Equals(builder.Environment.EnvironmentName, "Testing", StringComparison.OrdinalIgnoreCase)))
{
    // Keep the Vite app in local/test orchestration. Production frontend is served by Azure Static Web Apps.
    var client = builder.AddViteApp("client", "../client")
        .WithReference(api)
        .WithEnvironment("VITE_REACT_APP_API_BASE_URL", api.GetEndpoint("http"))
        // AddViteApp sets NODE_ENV from Environment.IsDevelopment(), which only matches the
        // literal "Development" environment name. In "Testing" that resolves to NODE_ENV=production,
        // which makes @vitejs/plugin-react skip injecting the React-Refresh preamble — every
        // component module then throws "$RefreshReg$ is not defined" on load and the app never
        // mounts. Force dev mode here so Playwright-driven integration tests get a working app.
        .WithEnvironment("NODE_ENV", "development")
        .WaitFor(api);
}

builder.Build().Run();
