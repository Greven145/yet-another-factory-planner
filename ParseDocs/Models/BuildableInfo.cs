namespace ParseDocs.Models;

public class BuildableInfo
{
    public string Slug { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<string> Categories { get; set; } = [];
    public int? BuildMenuPriority { get; set; }
    public bool IsPowered { get; set; }
    public bool IsOverclockable { get; set; }
    public bool IsProduction { get; set; }
    public bool IsResourceExtractor { get; set; }
    public bool IsGenerator { get; set; }
    public bool IsVehicle { get; set; }
    public BuildableMeta? Meta { get; set; }
    public EventType Event { get; set; }
}