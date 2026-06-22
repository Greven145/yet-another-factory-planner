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
