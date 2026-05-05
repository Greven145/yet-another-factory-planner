namespace ParseDocs.Models;

public class Resource {
    public Resource(string itemClass, double? maxExtraction, double relativeValue) {
        ItemClass = itemClass;
        MaxExtraction = maxExtraction;
        RelativeValue = relativeValue;
    }

    public string ItemClass { get; init; }
    public double? MaxExtraction { get; init; }
    public double RelativeValue { get; set; }

    public void Deconstruct(out string itemClass, out double? maxExtraction, out double relativeValue) {
        itemClass = ItemClass;
        maxExtraction = MaxExtraction;
        relativeValue = RelativeValue;
    }
}