namespace ParseDocs.Models;

public class BuildableMeta
{
    public PoweredMeta? PowerInfo { get; set; }
    public OverclockMeta? OverclockInfo { get; set; }
    public ResourceExtractorMeta? ExtractorInfo { get; set; }
    public GeneratorMeta? GeneratorInfo { get; set; }
    public VehicleMeta? VehicleInfo { get; set; }
    public BuildableSize? Size { get; set; }
    public double BeltSpeed { get; set; }
    public int InventorySize { get; set; }
    public int PowerStorageCapacity { get; set; }
    public double FlowLimit { get; set; }
    public double HeadLift { get; set; }
    public double HeadLiftMax { get; set; }
    public double FluidStorageCapacity { get; set; }
    public RadarTowerMeta? RadarInfo { get; set; }
}