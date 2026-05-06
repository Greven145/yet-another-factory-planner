using api;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults()
    .ConfigureServices((context, services) => {
        var configuration = context.Configuration;

        var connectionString =
            configuration["Aspire__Microsoft__Azure__Cosmos__cosmos-db__ConnectionString"]
            ?? configuration["Aspire:Microsoft:Azure:Cosmos:cosmos-db:ConnectionString"]
            ?? configuration["ConnectionStrings:cosmos-db"];

        if (string.IsNullOrEmpty(connectionString))
        {
            throw new InvalidOperationException(
                "Cosmos DB connection string not found. Tried keys: " +
                "Aspire__Microsoft__Azure__Cosmos__cosmos-db__ConnectionString, " +
                "Aspire:Microsoft:Azure:Cosmos:cosmos-db:ConnectionString, " +
                "ConnectionStrings:cosmos-db");
        }

        // Create a CosmosClient
        var cosmosClient = new CosmosClient(connectionString, new CosmosClientOptions
        {
            ConnectionMode = ConnectionMode.Gateway,
            SerializerOptions = new CosmosSerializationOptions 
            { 
                PropertyNamingPolicy = CosmosPropertyNamingPolicy.CamelCase
            },
            RequestTimeout = TimeSpan.FromSeconds(10)
        });
        
        services.AddSingleton(cosmosClient);
        services.AddScoped<FactoryClient>();
    })
    .Build();

host.Run();