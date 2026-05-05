using api.Models;
using Microsoft.Azure.Cosmos;
using OneOf;
using OneOf.Types;

namespace api;

public sealed class FactoryClient
{
    private readonly CosmosClient _cosmosClient;

    public FactoryClient(CosmosClient cosmosClient)
    {
        _cosmosClient = cosmosClient;
    }

    internal async Task SaveFactory(FactoryConfigSchema factoryConfig)
    {
        var database = _cosmosClient.GetDatabase("shared-factory");
        var container = database.GetContainer("factories");
        
        try
        {
            await container.CreateItemAsync(factoryConfig, new PartitionKey(factoryConfig.GameVersion));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error saving factory: {ex}");
            throw;
        }
    }

    internal async Task<GetFactoryResult> GetFactory(string factoryKey, string gameVersion,
        CancellationToken cancellationToken = default)
    {
        var database = _cosmosClient.GetDatabase("shared-factory");
        var container = database.GetContainer("factories");
        
        try
        {
            var factory = await container.ReadItemAsync<FactoryConfigSchema>(factoryKey, new PartitionKey(gameVersion), cancellationToken: cancellationToken);
            return factory.Resource;
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return new None();
        }
    }
}

[GenerateOneOf]
public partial class GetFactoryResult : OneOfBase<FactoryConfigSchema, None>
{
}