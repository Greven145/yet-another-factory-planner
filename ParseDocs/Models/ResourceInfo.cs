namespace ParseDocs.Models;

public class ResourceInfo
{
    public string ItemClass { get; set; } = string.Empty;
    public string? Form { get; set; }
    public NodeCounts? Nodes { get; set; }
    public WellCounts? ResourceWells { get; set; }
    public double? MaxExtraction { get; set; }
    public Color? PingColor { get; set; }
    public double CollectionSpeed { get; set; }
    public EventType Event { get; set; }
}