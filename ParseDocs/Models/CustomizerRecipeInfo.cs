namespace ParseDocs.Models;

public class CustomizerRecipeInfo
{
    public string Slug { get; set; } = string.Empty;
    public bool IsSwatch { get; set; }
    public bool IsPatternRemover { get; set; }
    public List<ItemQuantity>? Ingredients { get; set; }
    public EventType Event { get; set; }
}