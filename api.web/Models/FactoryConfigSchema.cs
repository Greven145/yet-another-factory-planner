namespace api.Models;

public class FactoryConfigSchema
{
    public string? Id { get; set; }
    public string GameVersion { get; set; } = "1.1";
    public List<ProductionItems> ProductionItems { get; set; } = [];
    public List<Input> InputItems { get; set; } = [];
    public List<Input> InputResources { get; set; } = [];
    public List<string> AllowedRecipes { get; set; } = [];
    public List<NodePosition> NodesPositions { get; set; } = [];
    public WeightingOptions WeightingOptions { get; set; } = new(1000, 1, 0, 0);
    public bool AllowHandGatheredItems { get; set; }
}
