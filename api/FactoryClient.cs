using System.Net;
using api.Models;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Configuration;
using OneOf;
using OneOf.Types;

namespace api;

internal sealed class FactoryClient {
    private const string ContainerId = "factories";
    private const string DatabaseId = "shared-factory";

    private static readonly CosmosClientOptions ClientOptions = new() {
        ApplicationName = "yafpclone",
        SerializerOptions = new CosmosSerializationOptions
            { PropertyNamingPolicy = CosmosPropertyNamingPolicy.CamelCase }
    };

    private readonly IConfiguration _configuration;

    internal FactoryClient(IConfiguration configuration) {
        _configuration = configuration;
    }

    internal async Task SaveFactory(FactoryConfigSchema factoryConfig, CancellationToken cancellationToken = default) {
        var container = await GetContainer();
        await container.CreateItemAsync(factoryConfig, cancellationToken: cancellationToken);
    }

    internal async Task<GetFactoryResult> GetFactory(string factoryKey, string gameVersion,
        CancellationToken cancellationToken = default) {
        var container = await GetContainer();
        var readResponse = await container.ReadItemAsync<FactoryConfigSchema>(factoryKey, new PartitionKey(gameVersion),
            cancellationToken: cancellationToken);

        if (readResponse.StatusCode == HttpStatusCode.NotFound) {
            return new None();
        }

        return readResponse.Resource;
    }

    private async Task<Container> GetContainer() {
        var client = new CosmosClient(_configuration["EndPointUri"],
            _configuration["CosmosKey"],
            ClientOptions);
        DatabaseResponse databaseResponse = await client.CreateDatabaseIfNotExistsAsync(DatabaseId);
        Database targetDatabase = databaseResponse.Database;
        ContainerResponse containerResponse = await targetDatabase.CreateContainerIfNotExistsAsync(ContainerId,"/gameVersion");
        return containerResponse.Container;
    }
}

[GenerateOneOf]
public partial class GetFactoryResult : OneOfBase<FactoryConfigSchema, None> {
}