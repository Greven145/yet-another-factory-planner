namespace ParseDocs.Models;

public class BuildableRecipeInfo
{
    public string Slug { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public List<ItemQuantity>? Ingredients { get; set; }
    public string Product { get; set; } = string.Empty;
    public EventType Event { get; set; }
}