namespace api.Models;

public record FactoryConfigSchema {
    public string[] AllowedRecipes { get; init; } = [];
    public bool AllowHandGatheredItems { get; init; }
    public string GameVersion { get; init; } = "U7";
    public string? Id { get; init; }
    public Input[] InputItems { get; init; } = [];
    public Input[] InputResources { get; init; } = [];
    public ProductionItems[] ProductionItems { get; init; } = [];
    public WeightingOptions WeightingOptions { get; init; } = new(1000, 1, 0, 0);
    public NodePosition[] NodesPositions { get; init; } = [];
}