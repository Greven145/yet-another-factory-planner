namespace ParseDocs.Models;

public class SchematicUnlocks
{
    public List<string> Recipes { get; set; } = new();
    public List<string> Schematics { get; set; } = new();
    public List<string> ScannerResources { get; set; } = new();
    public int InventorySlots { get; set; }
    public int EquipmentHandSlots { get; set; }
    public bool EfficiencyPanel { get; set; }
    public bool OverclockPanel { get; set; }
    public bool Map { get; set; }
    public List<ItemQuantity>? GiveItems { get; set; }
    public List<string> Emotes { get; set; } = new();
    public bool Customizer { get; set; }
}