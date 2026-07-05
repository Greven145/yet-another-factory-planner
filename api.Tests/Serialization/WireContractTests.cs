using System.Text.Json;
using api.Models;
using Xunit;

namespace api.Tests.Serialization;

/// <summary>
/// Pins the JSON wire contract shared by the Azure Functions API (api.functions) and the client.
/// The functions worker serializes both HTTP responses and Cosmos documents with
/// <c>new JsonSerializerOptions(JsonSerializerDefaults.Web)</c> (camelCase). These tests assert the
/// exact key casing the client hooks and Cosmos depend on, so a serializer regression fails here
/// rather than silently orphaning share links.
/// </summary>
public class WireContractTests
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    private static FactoryConfigSchema SampleConfig() => new()
    {
        Id = "6a012cfd4bee911e",
        GameVersion = "V1_2",
        ProductionItems = [new ProductionItems("Desc_IronPlate_C", "per-minute", 20)],
        InputItems = [new Input("Desc_IronIngot_C", 100, 0, false)],
        InputResources = [new Input("Desc_OreIron_C", 5000, 1, false)],
        AllowedRecipes = ["Recipe_IronPlate_C"],
        NodesPositions = [new NodePosition("node-1", 10, 20)],
        WeightingOptions = new WeightingOptions(1000, 1, 0, 0),
        GameModeOptions = new GameModeOptions(1, 1),
        AllowHandGatheredItems = true,
    };

    [Fact]
    public void FactoryConfig_SerializesCamelCase_WithLowercaseCosmosId()
    {
        var json = JsonSerializer.Serialize(SampleConfig(), Web);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        // Cosmos requires a lowercase "id"; the partition key property is "gameVersion".
        Assert.True(root.TryGetProperty("id", out _));
        Assert.Equal("6a012cfd4bee911e", root.GetProperty("id").GetString());
        Assert.Equal("V1_2", root.GetProperty("gameVersion").GetString());

        // Every field the client's share-load path reads, in camelCase.
        foreach (var field in new[]
                 {
                     "productionItems", "inputItems", "inputResources", "allowedRecipes",
                     "nodesPositions", "weightingOptions", "gameModeOptions", "allowHandGatheredItems",
                 })
        {
            Assert.True(root.TryGetProperty(field, out _), $"Missing camelCase field '{field}'.");
        }
    }

    [Fact]
    public void GetSharedFactory_EnvelopePreservesFactoryConfigKey()
    {
        // The GET response envelope: { "data": { "factory_config": <config> } }.
        // camelCase policy must NOT rewrite the snake_case "factory_config" key the client reads.
        var envelope = new { data = new { factory_config = SampleConfig() } };
        var json = JsonSerializer.Serialize(envelope, Web);

        using var doc = JsonDocument.Parse(json);
        var factoryConfig = doc.RootElement.GetProperty("data").GetProperty("factory_config");
        Assert.Equal("V1_2", factoryConfig.GetProperty("gameVersion").GetString());
    }

    [Fact]
    public void ShareFactory_RequestDeserializes_FromCamelCaseBody()
    {
        // The client posts { "factoryConfig": { ... } }; the worker must bind it to FactoryConfig.
        const string body = """{"factoryConfig":{"gameVersion":"V1_2","productionItems":[{"itemKey":"Desc_IronPlate_C","mode":"per-minute","value":20}]}}""";

        var request = JsonSerializer.Deserialize<ShareFactoryRequest>(body, Web);

        Assert.NotNull(request);
        Assert.Equal("V1_2", request!.FactoryConfig.GameVersion);
        Assert.Single(request.FactoryConfig.ProductionItems);
        Assert.Equal("Desc_IronPlate_C", request.FactoryConfig.ProductionItems[0].ItemKey);
    }
}
