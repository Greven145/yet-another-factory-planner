namespace api.Models;

public record FactoryConfigSchema {
    public string[] AllowedRecipes { get; init; } = Array.Empty<string>();
    public bool AllowHandGatheredItems { get; init; }
    public string GameVersion { get; init; } = "U7";
    public string? Id { get; init; }
    public Input[] InputItems { get; init; } = Array.Empty<Input>();
    public Input[] InputResources { get; init; } = Array.Empty<Input>();
    public ProductionItems[] ProductionItems { get; init; } = Array.Empty<ProductionItems>();
    public WeightingOptions WeightingOptions { get; init; } = new(1000, 1, 0, 0);
}