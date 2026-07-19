using api.Models;
using api.Services;
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

    // Default amplification (0/0) and no building restriction must NOT change the canonical bytes,
    // so a config that predates these fields keeps its historical id. The pinned test above already
    // asserts the exact value; this one pins the equivalence explicitly.
    [Fact]
    public void Compute_DefaultAmplificationAndBuildings_MatchesPreFeatureId()
    {
        var withDefaults = KnownConfig();
        withDefaults.AmplificationOptions = new AmplificationOptions(0, 0);
        withDefaults.AllowedBuildings = [];

        Assert.Equal("6a012cfd4bee911e", ShareFactoryId.Compute(withDefaults));
    }

    [Fact]
    public void Compute_NonZeroAmplification_DiffersFromDefault()
    {
        var boosted = KnownConfig();
        boosted.AmplificationOptions = new AmplificationOptions(10, 5);

        Assert.NotEqual(ShareFactoryId.Compute(KnownConfig()), ShareFactoryId.Compute(boosted));
    }

    // Collision guard: configs differing only by boost budget are genuinely different factories and
    // must not dedupe onto the same id.
    [Fact]
    public void Compute_DifferentSloopCounts_ProduceDifferentIds()
    {
        var a = KnownConfig();
        a.AmplificationOptions = new AmplificationOptions(4, 0);
        var b = KnownConfig();
        b.AmplificationOptions = new AmplificationOptions(8, 0);

        Assert.NotEqual(ShareFactoryId.Compute(a), ShareFactoryId.Compute(b));
    }

    [Fact]
    public void Compute_DifferentAllowedBuildings_ProduceDifferentIds()
    {
        var a = KnownConfig();
        a.AllowedBuildings = ["Build_SmelterMk1_C"];
        var b = KnownConfig();
        b.AllowedBuildings = ["Build_SmelterMk1_C", "Build_ConstructorMk1_C"];

        Assert.NotEqual(ShareFactoryId.Compute(a), ShareFactoryId.Compute(b));
    }

    // AllowedBuildings ordering must be normalized away, matching AllowedRecipes.
    [Fact]
    public void Compute_AllowedBuildings_IsOrderInsensitive()
    {
        var a = KnownConfig();
        a.AllowedBuildings = ["Build_SmelterMk1_C", "Build_ConstructorMk1_C"];
        var b = KnownConfig();
        b.AllowedBuildings = ["Build_ConstructorMk1_C", "Build_SmelterMk1_C"];

        Assert.Equal(ShareFactoryId.Compute(a), ShareFactoryId.Compute(b));
    }
}
