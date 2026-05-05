using api.Models;
using api.Validation;
using FluentValidation.TestHelper;
using Xunit;

namespace api.Tests.Validation;

public class FactoryConfigSchemaValidatorTests {
	private readonly FactoryConfigSchemaValidator _validator = new();

	private static FactoryConfigSchema CreateValidConfig() => new() {
		GameVersion = "V1_1",
		ProductionItems = new[] {
			new ProductionItems("Desc_IronPlate_C", "per-minute", 10)
		},
		InputItems = Array.Empty<Input>(),
		InputResources = new[] {
			new Input("Desc_OreIron_C", 70380, 1, false)
		},
		AllowHandGatheredItems = false,
		WeightingOptions = new WeightingOptions(1000, 1, 0, 0),
		AllowedRecipes = new[] { "Recipe_IronIngot_C", "Recipe_IronPlate_C" },
		NodesPositions = Array.Empty<NodePosition>(),
	};

	[Fact]
	public void ValidConfig_ShouldPass() {
		var config = CreateValidConfig();
		var result = _validator.TestValidate(config);
		result.ShouldNotHaveAnyValidationErrors();
	}

	// GameVersion validation
	[Theory]
	[InlineData("V1_1")]
	public void ValidGameVersions_ShouldPass(string version) {
		var config = CreateValidConfig() with { GameVersion = version };
		var result = _validator.TestValidate(config);
		result.ShouldNotHaveValidationErrorFor(x => x.GameVersion);
	}

	[Theory]
	[InlineData("")]
	[InlineData("U8")]
	[InlineData("invalid")]
	public void InvalidGameVersion_ShouldFail(string version) {
		var config = CreateValidConfig() with { GameVersion = version };
		var result = _validator.TestValidate(config);
		result.ShouldHaveValidationErrorFor(x => x.GameVersion);
	}

	// ProductionItems validation
	[Fact]
	public void EmptyProductionItems_ShouldFail() {
		var config = CreateValidConfig() with { ProductionItems = Array.Empty<ProductionItems>() };
		var result = _validator.TestValidate(config);
		result.ShouldHaveValidationErrorFor(x => x.ProductionItems);
	}

	[Fact]
	public void ProductionItem_EmptyItemKey_ShouldFail() {
		var config = CreateValidConfig() with {
			ProductionItems = new[] { new ProductionItems("", "per-minute", 10) }
		};
		var result = _validator.TestValidate(config);
		result.ShouldHaveValidationErrorFor("ProductionItems[0].ItemKey");
	}

	[Fact]
	public void ProductionItem_EmptyMode_ShouldFail() {
		var config = CreateValidConfig() with {
			ProductionItems = new[] { new ProductionItems("Desc_IronPlate_C", "", 10) }
		};
		var result = _validator.TestValidate(config);
		result.ShouldHaveValidationErrorFor("ProductionItems[0].Mode");
	}

	// InputResources validation
	[Fact]
	public void EmptyInputResources_ShouldFail() {
		var config = CreateValidConfig() with { InputResources = Array.Empty<Input>() };
		var result = _validator.TestValidate(config);
		result.ShouldHaveValidationErrorFor(x => x.InputResources);
	}

	[Fact]
	public void InputResource_EmptyItemKey_ShouldFail() {
		var config = CreateValidConfig() with {
			InputResources = new[] { new Input("", 100, 1, false) }
		};
		var result = _validator.TestValidate(config);
		result.ShouldHaveValidationErrorFor("InputResources[0].ItemKey");
	}

	// InputItems validation
	[Fact]
	public void InputItem_EmptyItemKey_ShouldFail() {
		var config = CreateValidConfig() with {
			InputItems = new[] { new Input("", 100, 1, false) }
		};
		var result = _validator.TestValidate(config);
		result.ShouldHaveValidationErrorFor("InputItems[0].ItemKey");
	}

	[Fact]
	public void ValidInputItems_ShouldPass() {
		var config = CreateValidConfig() with {
			InputItems = new[] { new Input("Desc_IronIngot_C", 50, 0, false) }
		};
		var result = _validator.TestValidate(config);
		result.ShouldNotHaveValidationErrorFor(x => x.InputItems);
	}

	// AllowedRecipes validation
	[Fact]
	public void EmptyAllowedRecipes_ShouldFail() {
		var config = CreateValidConfig() with { AllowedRecipes = Array.Empty<string>() };
		var result = _validator.TestValidate(config);
		result.ShouldHaveValidationErrorFor(x => x.AllowedRecipes);
	}

	[Fact]
	public void AllowedRecipes_WithEmptyString_ShouldFail() {
		var config = CreateValidConfig() with { AllowedRecipes = new[] { "" } };
		var result = _validator.TestValidate(config);
		result.ShouldHaveValidationErrorFor("AllowedRecipes[0]");
	}

	// NodesPositions validation
	[Fact]
	public void ValidNodesPositions_ShouldPass() {
		var config = CreateValidConfig() with {
			NodesPositions = new[] { new NodePosition("node1", 10.5m, 20.3m) }
		};
		var result = _validator.TestValidate(config);
		result.ShouldNotHaveAnyValidationErrors();
	}

	[Fact]
	public void NodePosition_EmptyKey_ShouldFail() {
		var config = CreateValidConfig() with {
			NodesPositions = new[] { new NodePosition("", 10.5m, 20.3m) }
		};
		var result = _validator.TestValidate(config);
		result.ShouldHaveValidationErrorFor("NodesPositions[0].Key");
	}

	// WeightingOptions validation
	[Fact]
	public void NullWeightingOptions_ShouldFail() {
		var config = CreateValidConfig() with { WeightingOptions = null! };
		var result = _validator.TestValidate(config);
		result.ShouldHaveValidationErrorFor(x => x.WeightingOptions);
	}

	// Multiple production items
	[Fact]
	public void MultipleValidProductionItems_ShouldPass() {
		var config = CreateValidConfig() with {
			ProductionItems = new[] {
				new ProductionItems("Desc_IronPlate_C", "per-minute", 10),
				new ProductionItems("Desc_IronIngot_C", "maximize", 5),
			}
		};
		var result = _validator.TestValidate(config);
		result.ShouldNotHaveAnyValidationErrors();
	}
}
