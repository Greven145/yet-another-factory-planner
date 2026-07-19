namespace api.Models;

public class FactoryConfigSchema
{
    public string? Id { get; set; }
    public string GameVersion { get; set; } = "1.2";
    public List<ProductionItems> ProductionItems { get; set; } = [];
    public List<Input> InputItems { get; set; } = [];
    public List<Input> InputResources { get; set; } = [];
    public List<string> AllowedRecipes { get; set; } = [];
    public List<NodePosition> NodesPositions { get; set; } = [];
    public WeightingOptions WeightingOptions { get; set; } = new(1000, 1, 0, 0);
    public GameModeOptions GameModeOptions { get; set; } = new(1, 1);
    // Somersloop/power-shard budgets. Defaulted so pre-feature clients and old Cosmos docs deserialize to 0/0.
    public AmplificationOptions AmplificationOptions { get; set; } = new(0, 0);
    // Enabled building keys. Empty = all buildings allowed (pre-feature shares omit it).
    public List<string> AllowedBuildings { get; set; } = [];
    public bool AllowHandGatheredItems { get; set; }
}
