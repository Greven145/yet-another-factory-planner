using api.Models;
using api.Validation;
using FluentValidation.TestHelper;
using Xunit;

namespace api.Tests.Validation;

public class FactoryConfigSchemaValidatorTests
{
    private readonly FactoryConfigSchemaValidator _validator = new();

    private static FactoryConfigSchema CreateValidConfig() => new()
    {
        GameVersion = "V1_1",
        ProductionItems =
        [
            new ProductionItems("Desc_IronPlate_C", "per-minute", 10)
        ],
        InputItems = [],
        InputResources =
        [
            new Input("Desc_OreIron_C", 70380, 1, false)
        ],
        AllowHandGatheredItems = false,
        WeightingOptions = new WeightingOptions(1000, 1, 0, 0),
        AllowedRecipes = ["Recipe_IronIngot_C", "Recipe_IronPlate_C"],
        NodesPositions = [],
    };

    [Fact]
    public void ValidConfig_ShouldPass()
    {
        var config = CreateValidConfig();
        var result = _validator.TestValidate(config);
        result.ShouldNotHaveAnyValidationErrors();
    }

    // GameVersion validation
    [Theory]
    [InlineData("V1_1")]
    [InlineData("1.1")]
    public void ValidConfig_ValidGameVersions_ShouldPass(string version)
    {
        var config = CreateValidConfig();
        config.GameVersion = version;
        var result = _validator.TestValidate(config);
        result.ShouldNotHaveValidationErrorFor(x => x.GameVersion);
    }

    [Theory]
    [InlineData("")]
    [InlineData("U8")]
    [InlineData("invalid")]
    public void ValidConfig_InvalidGameVersion_ShouldFail(string version)
    {
        var config = CreateValidConfig();
        config.GameVersion = version;
        var result = _validator.TestValidate(config);
        result.ShouldHaveValidationErrorFor(x => x.GameVersion);
    }

    // ProductionItems validation
    [Fact]
    public void ValidConfig_EmptyProductionItems_ShouldFail()
    {
        var config = CreateValidConfig();
        config.ProductionItems = [];
        var result = _validator.TestValidate(config);
        result.ShouldHaveValidationErrorFor(x => x.ProductionItems);
    }

    [Fact]
    public void ValidConfig_ProductionItemsExceedingLimit_ShouldFail()
    {
        var config = CreateValidConfig();
        config.ProductionItems = Enumerable.Range(0, 501)
            .Select(i => new ProductionItems($"Item_{i}", "per-minute", 1))
            .ToList();
        var result = _validator.TestValidate(config);
        result.ShouldHaveValidationErrorFor(x => x.ProductionItems);
    }

    [Fact]
    public void ValidConfig_ProductionItem_EmptyItemKey_ShouldFail()
    {
        var config = CreateValidConfig();
        config.ProductionItems = [new ProductionItems("", "per-minute", 10)];
        var result = _validator.TestValidate(config);
        result.ShouldHaveValidationErrorFor("ProductionItems[0].ItemKey");
    }

    [Fact]
    public void ValidConfig_ProductionItem_EmptyMode_ShouldFail()
    {
        var config = CreateValidConfig();
        config.ProductionItems = [new ProductionItems("Desc_IronPlate_C", "", 10)];
        var result = _validator.TestValidate(config);
        result.ShouldHaveValidationErrorFor("ProductionItems[0].Mode");
    }

    // ProductionItems.Mode validation
    [Theory]
    [InlineData("per-minute")]
    [InlineData("maximize")]
    [InlineData("rate")]
    public void ValidConfig_ProductionItem_ValidMode_ShouldPass(string mode)
    {
        var config = CreateValidConfig();
        config.ProductionItems = [new ProductionItems("Desc_IronPlate_C", mode, 10)];
        var result = _validator.TestValidate(config);
        result.ShouldNotHaveValidationErrorFor("ProductionItems[0].Mode");
    }

    [Theory]
    [InlineData("invalid")]
    [InlineData("per_minute")]
    [InlineData("MAXIMIZE")]
    [InlineData("Rate")]
    public void ValidConfig_ProductionItem_InvalidMode_ShouldFail(string mode)
    {
        var config = CreateValidConfig();
        config.ProductionItems = [new ProductionItems("Desc_IronPlate_C", mode, 10)];
        var result = _validator.TestValidate(config);
        result.ShouldHaveValidationErrorFor("ProductionItems[0].Mode");
    }

    // InputResources validation
    [Fact]
    public void ValidConfig_EmptyInputResources_ShouldPass()
    {
        var config = CreateValidConfig();
        config.InputResources = [];
        var result = _validator.TestValidate(config);
        result.ShouldNotHaveValidationErrorFor(x => x.InputResources);
    }

    [Fact]
    public void ValidConfig_InputResourcesExceedingLimit_ShouldFail()
    {
        var config = CreateValidConfig();
        config.InputResources = Enumerable.Range(0, 501)
            .Select(i => new Input($"Desc_Ore_{i}", 100, 1, false))
            .ToList();
        var result = _validator.TestValidate(config);
        result.ShouldHaveValidationErrorFor(x => x.InputResources);
    }

    [Fact]
    public void ValidConfig_InputResource_EmptyItemKey_ShouldFail()
    {
        var config = CreateValidConfig();
        config.InputResources = [new Input("", 100, 1, false)];
        var result = _validator.TestValidate(config);
        result.ShouldHaveValidationErrorFor("InputResources[0].ItemKey");
    }

    // InputItems validation
    [Fact]
    public void ValidConfig_InputItem_EmptyItemKey_ShouldFail()
    {
        var config = CreateValidConfig();
        config.InputItems = [new Input("", 100, 1, false)];
        var result = _validator.TestValidate(config);
        result.ShouldHaveValidationErrorFor("InputItems[0].ItemKey");
    }

    [Fact]
    public void ValidConfig_ValidInputItems_ShouldPass()
    {
        var config = CreateValidConfig();
        config.InputItems = [new Input("Desc_IronIngot_C", 50, 0, false)];
        var result = _validator.TestValidate(config);
        result.ShouldNotHaveValidationErrorFor(x => x.InputItems);
    }

    [Fact]
    public void ValidConfig_InputItemsExceedingLimit_ShouldFail()
    {
        var config = CreateValidConfig();
        config.InputItems = Enumerable.Range(0, 501)
            .Select(i => new Input($"Item_{i}", 50, 1, false))
            .ToList();
        var result = _validator.TestValidate(config);
        result.ShouldHaveValidationErrorFor(x => x.InputItems);
    }

    // AllowedRecipes validation
    [Fact]
    public void ValidConfig_EmptyAllowedRecipes_ShouldPass()
    {
        var config = CreateValidConfig();
        config.AllowedRecipes = [];
        var result = _validator.TestValidate(config);
        result.ShouldNotHaveValidationErrorFor(x => x.AllowedRecipes);
    }

    [Fact]
    public void ValidConfig_AllowedRecipesExceedingLimit_ShouldFail()
    {
        var config = CreateValidConfig();
        config.AllowedRecipes = Enumerable.Range(0, 501)
            .Select(i => $"Recipe_{i}")
            .ToList();
        var result = _validator.TestValidate(config);
        result.ShouldHaveValidationErrorFor(x => x.AllowedRecipes);
    }

    [Fact]
    public void ValidConfig_AllowedRecipes_WithEmptyString_ShouldFail()
    {
        var config = CreateValidConfig();
        config.AllowedRecipes = [""];
        var result = _validator.TestValidate(config);
        result.ShouldHaveValidationErrorFor("AllowedRecipes[0]");
    }

    // NodesPositions validation
    [Fact]
    public void ValidConfig_ValidNodesPositions_ShouldPass()
    {
        var config = CreateValidConfig();
        config.NodesPositions = [new NodePosition("node1", 10.5m, 20.3m)];
        var result = _validator.TestValidate(config);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void ValidConfig_NodePosition_EmptyKey_ShouldFail()
    {
        var config = CreateValidConfig();
        config.NodesPositions = [new NodePosition("", 10.5m, 20.3m)];
        var result = _validator.TestValidate(config);
        result.ShouldHaveValidationErrorFor("NodesPositions[0].Key");
    }

    [Fact]
    public void ValidConfig_NodesPositionsExceedingLimit_ShouldFail()
    {
        var config = CreateValidConfig();
        config.NodesPositions = Enumerable.Range(0, 1001)
            .Select(i => new NodePosition($"node_{i}", i, i))
            .ToList();
        var result = _validator.TestValidate(config);
        result.ShouldHaveValidationErrorFor(x => x.NodesPositions);
    }

    // WeightingOptions validation
    [Fact]
    public void ValidConfig_NullWeightingOptions_ShouldFail()
    {
        var config = CreateValidConfig();
        config.WeightingOptions = null!;
        var result = _validator.TestValidate(config);
        result.ShouldHaveValidationErrorFor(x => x.WeightingOptions);
    }

    // Multiple production items
    [Fact]
    public void ValidConfig_MultipleValidProductionItems_ShouldPass()
    {
        var config = CreateValidConfig();
        config.ProductionItems =
        [
            new ProductionItems("Desc_IronPlate_C", "per-minute", 10),
            new ProductionItems("Desc_IronIngot_C", "maximize", 5),
        ];
        var result = _validator.TestValidate(config);
        result.ShouldNotHaveAnyValidationErrors();
    }
}
