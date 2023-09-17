namespace ParseDocs.Models;

public class ItemMeta
{
    public Color? FluidColor { get; set; }
    public double EnergyValue { get; set; }
    public double RadioactiveDecay { get; set; }
    public EquipmentMeta? EquipmentInfo { get; set; }
}