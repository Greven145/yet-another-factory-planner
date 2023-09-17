namespace ParseDocs.Models;

public class ItemInfo
{
    public string Slug { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int StackSize { get; set; }
    public int SinkPoints { get; set; }
    public bool IsFluid { get; set; }
    public bool IsFuel { get; set; }
    public bool IsBiomass { get; set; }
    public bool IsRadioactive { get; set; }
    public bool IsEquipment { get; set; }
    public ItemMeta? Meta { get; set; }
    public EventType Event { get; set; }
}