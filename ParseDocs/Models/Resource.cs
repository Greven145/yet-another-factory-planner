namespace ParseDocs.Models;

public class Resource(string itemClass, double? maxExtraction, double relativeValue) {
    public string ItemClass { get; init; } = itemClass;
    public double? MaxExtraction { get; init; } = maxExtraction;
    public double RelativeValue { get; set; } = relativeValue;

    public void Deconstruct(out string itemClass, out double? maxExtraction, out double relativeValue) {
        itemClass = ItemClass;
        maxExtraction = MaxExtraction;
        relativeValue = RelativeValue;
    }
}