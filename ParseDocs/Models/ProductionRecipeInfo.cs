namespace ParseDocs.Models;

public class ProductionRecipeInfo
{
    public string Slug { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal CraftTime { get; set; }
    public decimal ManualCraftMultiplier { get; set; }
    public bool IsAlternate { get; set; }
    public bool HandCraftable { get; set; }
    public bool WorkshopCraftable { get; set; }
    public bool MachineCraftable { get; set; }
    public List<ItemQuantity> Ingredients { get; set; } = new();
    public List<ItemQuantity> Products { get; set; } = new();
    public string ProducedIn { get; set; } = string.Empty;
    public EventType Event { get; set; }
}