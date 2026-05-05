using api.Models;
using FluentValidation;

namespace api.Validation;

public class FactoryConfigSchemaValidator : AbstractValidator<FactoryConfigSchema>
{
    // Accept both the client-facing "1.1" format and the internal "V1_1" enum name.
    private static readonly HashSet<string> ValidGameVersions =
    [
        .. Enum.GetNames<GameVersion>(),
        "1.1",
    ];

    public FactoryConfigSchemaValidator()
    {
        RuleFor(x => x.GameVersion).Must(v => ValidGameVersions.Contains(v))
            .WithMessage("'{PropertyValue}' is not a valid game version.");
        RuleFor(x => x.ProductionItems).NotEmpty();
        RuleForEach(x => x.ProductionItems).SetValidator(new ProductionItemsValidator());
        RuleForEach(x => x.InputItems).SetValidator(new InputValidator());
        // InputResources may be empty (no constraints means unlimited resources)
        RuleForEach(x => x.InputResources).SetValidator(new InputValidator());
        RuleFor(x => x.WeightingOptions).NotNull().SetValidator(new WeightingOptionsValidator());
        // AllowedRecipes may be empty (means all recipes are allowed)
        RuleForEach(x => x.AllowedRecipes).NotEmpty();
        RuleForEach(x => x.NodesPositions).SetValidator(new NodePositionValidator());
    }

    private sealed class ProductionItemsValidator : AbstractValidator<ProductionItems>
    {
        public ProductionItemsValidator()
        {
            RuleFor(x => x.ItemKey).NotEmpty();
            RuleFor(x => x.Mode).NotEmpty();
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
