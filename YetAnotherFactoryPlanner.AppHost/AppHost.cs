using Azure.Provisioning.CosmosDB;

var builder = DistributedApplication.CreateBuilder(args);

#pragma warning disable ASPIRECOSMOSDB001
var cosmosDb = builder.AddAzureCosmosDB("cosmosdb")
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

// Azure Functions (.NET 8 isolated) API. Replaces the ACA-hosted api.web: in production this is
// deployed as Azure Static Web Apps managed functions (served same-origin at /api/*), which removes
// the scale-from-zero cold start on the share path. Locally, Aspire's Functions integration runs it
// via the Azure Functions Core Tools and injects the Cosmos connection string (ConnectionStrings__cosmosdb)
// plus a host-storage (Azurite) connection for AzureWebJobsStorage. The ACA publish/probe/blue-green
// config is gone — SWA owns hosting now (see Step 3 for the infra/CI teardown).
var api = builder.AddAzureFunctionsProject<Projects.api_functions>("api")
    .WithExternalHttpEndpoints()
    .WithReference(cosmosDb)
    .WaitFor(cosmosDb);

if (builder.ExecutionContext.IsRunMode &&
    (string.Equals(builder.Environment.EnvironmentName, "Development", StringComparison.OrdinalIgnoreCase)
    || string.Equals(builder.Environment.EnvironmentName, "Testing", StringComparison.OrdinalIgnoreCase)))
{
    // Keep the Vite app in local/test orchestration. Production frontend is served by Azure Static Web Apps.
    var client = builder.AddViteApp("client", "../client")
        .WithReference(api)
        // The client reads import.meta.env.VITE_API_BASE_URL (see client/src/api/index.ts and
        // client/.env.example); inject that exact name so axios gets a real base URL. Functions serve
        // under /api (the default route prefix), so the base must be the functions host endpoint PLUS
        // "/api" — then axios get('/share-factory') resolves to /api/share-factory, mirroring the
        // same-origin /api base SWA uses in production. Without the suffix the calls 404.
        .WithEnvironment("VITE_API_BASE_URL", ReferenceExpression.Create($"{api.GetEndpoint("http")}/api"))
        // AddViteApp sets NODE_ENV from Environment.IsDevelopment(), which only matches the
        // literal "Development" environment name. In "Testing" that resolves to NODE_ENV=production,
        // which makes @vitejs/plugin-react skip injecting the React-Refresh preamble — every
        // component module then throws "$RefreshReg$ is not defined" on load and the app never
        // mounts. Force dev mode here so Playwright-driven integration tests get a working app.
        .WithEnvironment("NODE_ENV", "development")
        .WaitFor(api);
}

builder.Build().Run();
