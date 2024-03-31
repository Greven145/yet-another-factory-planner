namespace ParseDocs.Models;

public class ResourceExtractorMeta
{
    public List<string> AllowedResourceForms { get; set; } = [];
    public List<string> AllowedResources { get; set; } = [];
    public double ResourceExtractSpeed { get; set; }
}