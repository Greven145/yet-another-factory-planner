namespace ParseDocs.Models;

public class SchematicInfo
{
    public string Slug { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public int TechTier { get; set; }
    public List<ItemQuantity>? Cost { get; set; }
    public double TimeToComplete { get; set; }
    public SchematicUnlocks? Unlocks { get; set; }
    public EventType Event { get; set; }
}