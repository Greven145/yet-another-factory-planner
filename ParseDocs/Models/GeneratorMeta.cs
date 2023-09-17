namespace ParseDocs.Models;

public class GeneratorMeta
{
    public decimal PowerProduction { get; set; }
    public VariablePower? VariablePowerProduction { get; set; }
    public List<FuelConsumption>? Fuels { get; set; }
}