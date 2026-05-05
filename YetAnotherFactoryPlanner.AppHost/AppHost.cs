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
#pragma warning restore ASPIRECOSMOSDB001

// Add ASP.NET Core Web API project
var api = builder.AddProject<Projects.api_web>("api")
    .WithHttpEndpoint(port: 8000)
    .WithExternalHttpEndpoints()
    .WithReference(cosmosDb)
    .WaitFor(cosmosDb);

if (string.Equals(builder.Environment.EnvironmentName, "Development", StringComparison.OrdinalIgnoreCase)
    || string.Equals(builder.Environment.EnvironmentName, "Testing", StringComparison.OrdinalIgnoreCase))
{
    // Keep the Vite app in local/test orchestration. Production frontend is served by Azure Static Web Apps.
    var client = builder.AddViteApp("client", "../client")
        .WithReference(api)
        .WithEnvironment("VITE_REACT_APP_API_BASE_URL", api.GetEndpoint("http"))
        .WaitFor(api);
}

builder.Build().Run();
