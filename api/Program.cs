using api;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults()
    .ConfigureServices((context, services) => {
        var configuration = context.Configuration;
        
        // Print all environment variables for debugging
        var envVars = Environment.GetEnvironmentVariables();
        foreach (var key in envVars.Keys)
        {
            var keyStr = key as string;
            if (keyStr is null)
            {
                continue;
            }

            if (keyStr.Contains("cosmos", StringComparison.OrdinalIgnoreCase) || 
                keyStr.Contains("Aspire", StringComparison.OrdinalIgnoreCase))
            {
                Console.WriteLine($"{keyStr}={envVars[key]}");
            }
        }
        
        // Get the Cosmos connection string from Aspire - try all possible keys
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
        
        Console.WriteLine($"Using connection string: {connectionString}");
        
        // Test that we can create a CosmosClient
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