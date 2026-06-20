using api.Models;
using api.web.Services;
using FluentValidation;

namespace api.Validation;

public class FactoryConfigSchemaValidator : AbstractValidator<FactoryConfigSchema>
{
    private static readonly HashSet<string> ValidModes = ["per-minute", "maximize", "rate"];

    public FactoryConfigSchemaValidator()
    {
        // Accepts both the client-facing "1.1" format and the internal "V1_1" enum name;
        // the vocabulary lives in GameVersions.
        RuleFor(x => x.GameVersion).Must(GameVersions.Valid.Contains)
            .WithMessage("'{PropertyValue}' is not a valid game version.");
        RuleFor(x => x.ProductionItems).NotEmpty()
            .Must(x => x.Count <= 500).WithMessage("ProductionItems must not exceed 500 items.");
        RuleForEach(x => x.ProductionItems).SetValidator(new ProductionItemsValidator());
        RuleFor(x => x.InputItems)
            .Must(x => x.Count <= 500).WithMessage("InputItems must not exceed 500 items.");
        RuleForEach(x => x.InputItems).SetValidator(new InputValidator());
        // InputResources may be empty (no constraints means unlimited resources)
        RuleFor(x => x.InputResources)
            .Must(x => x.Count <= 500).WithMessage("InputResources must not exceed 500 items.");
        RuleForEach(x => x.InputResources).SetValidator(new InputValidator());
        RuleFor(x => x.WeightingOptions).NotNull().SetValidator(new WeightingOptionsValidator());
        RuleFor(x => x.GameModeOptions).NotNull().SetValidator(new GameModeOptionsValidator());
        // AllowedRecipes may be empty (means all recipes are allowed)
        RuleFor(x => x.AllowedRecipes)
            .Must(x => x.Count <= 500).WithMessage("AllowedRecipes must not exceed 500 items.");
        RuleForEach(x => x.AllowedRecipes).NotEmpty();
        RuleFor(x => x.NodesPositions)
            .Must(x => x.Count <= 1000).WithMessage("NodesPositions must not exceed 1000 items.");
        RuleForEach(x => x.NodesPositions).SetValidator(new NodePositionValidator());
    }

    private sealed class ProductionItemsValidator : AbstractValidator<ProductionItems>
    {
        public ProductionItemsValidator()
        {
            RuleFor(x => x.ItemKey).NotEmpty();
            RuleFor(x => x.Mode).NotEmpty()
                .Must(m => ValidModes.Contains(m))
                .WithMessage($"Mode must be one of: {string.Join(", ", ValidModes)}.");
            RuleFor(x => x.Value).NotNull();
        }
    }

    private sealed class InputValidator : AbstractValidator<Input>
    {
        public InputValidator()
        {
            RuleFor(x => x.ItemKey).NotEmpty();
            RuleFor(x => x.Value).NotNull();
            RuleFor(x => x.Weight).NotNull();
            RuleFor(x => x.Unlimited).NotNull();
        }
    }

    private sealed class WeightingOptionsValidator : AbstractValidator<WeightingOptions>
    {
        public WeightingOptionsValidator()
        {
            RuleFor(x => x.Resources).NotNull();
            RuleFor(x => x.Power).NotNull();
            RuleFor(x => x.Complexity).NotNull();
            RuleFor(x => x.Buildings).NotNull();
        }
    }

    private sealed class GameModeOptionsValidator : AbstractValidator<GameModeOptions>
    {
        public GameModeOptionsValidator()
        {
            RuleFor(x => x.RecipePartsCost).GreaterThan(0);
            RuleFor(x => x.PowerConsumption).GreaterThan(0);
        }
    }

    private sealed class NodePositionValidator : AbstractValidator<NodePosition>
    {
        public NodePositionValidator()
        {
            RuleFor(x => x.Key).NotEmpty();
            RuleFor(x => x.X).NotNull();
            RuleFor(x => x.Y).NotNull();
        }
    }
}
