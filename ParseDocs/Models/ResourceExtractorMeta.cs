namespace ParseDocs.Models;

public class ResourceExtractorMeta
{
    public List<string> AllowedResourceForms { get; set; } = new();
    public List<string> AllowedResources { get; set; } = new();
    public double ResourceExtractSpeed { get; set; }
}