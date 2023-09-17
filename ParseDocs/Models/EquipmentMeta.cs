namespace ParseDocs.Models;

public class EquipmentMeta
{
    public EquipmentSlotType Slot { get; set; }
    public double HealthGain { get; set; }
    public double EnergyConsumption { get; set; }
    public double SawDownTreeTime { get; set; }
    public double Damage { get; set; }
    public int MagazineSize { get; set; }
    public double ReloadTime { get; set; }
    public double FireRate { get; set; }
    public double AttackDistance { get; set; }
    public double FilterDuration { get; set; }
    public double SprintSpeedFactor { get; set; }
    public double JumpSpeedFactor { get; set; }
    public double ExplosionDamage { get; set; }
    public double ExplosionRadius { get; set; }
    public double DetectionRange { get; set; }
}