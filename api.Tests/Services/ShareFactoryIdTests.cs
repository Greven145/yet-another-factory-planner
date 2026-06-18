using api.Models;
using api.web.Services;
using Xunit;

namespace api.Tests.Services;

public class ShareFactoryIdTests
{
    private static FactoryConfigSchema KnownConfig() => new()
    {
        GameVersion = "V1_2",
        ProductionItems =
        [
            new ProductionItems("Desc_IronPlate_C", "per-minute", 20),
            new ProductionItems("Desc_IronIngot_C", "maximize", 5),
        ],
        InputItems =
        [
            new Input("Desc_IronIngot_C", 100, 0, false),
        ],
        InputResources =
        [
            new Input("Desc_OreIron_C", 5000, 1, false),
            new Input("Desc_OreCopper_C", 2000, 2, false),
        ],
        AllowedRecipes = ["Recipe_IronPlate_C", "Recipe_IronIngot_C"],
        WeightingOptions = new WeightingOptions(1000, 1, 0, 0),
        GameModeOptions = new GameModeOptions(1, 1),
        AllowHandGatheredItems = true,
        NodesPositions = [],
    };

    // Pins the share-factory id for a known config. This id is a wire contract:
    // existing share links resolve by this exact value, so it must never change.
    // If this test fails, the canonicalization or hash algorithm drifted.
    [Fact]
    public void Compute_KnownConfig_ProducesPinnedId()
    {
        var id = ShareFactoryId.Compute(KnownConfig());
        Assert.Equal("6a012cfd4bee911e", id);
    }

    [Fact]
    public void Compute_IsDeterministic_RegardlessOfInputOrdering()
    {
        var a = KnownConfig();

        var b = KnownConfig();
        // Shuffle the orderings the canonicalizer is supposed to normalize away.
        b.ProductionItems.Reverse();
        b.InputResources.Reverse();
        b.AllowedRecipes.Reverse();

        Assert.Equal(ShareFactoryId.Compute(a), ShareFactoryId.Compute(b));
    }

    [Fact]
    public void Compute_Returns16HexChars()
    {
        var id = ShareFactoryId.Compute(KnownConfig());
        Assert.Equal(16, id.Length);
        Assert.Matches("^[0-9a-f]{16}$", id);
    }
}
