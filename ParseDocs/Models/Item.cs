namespace ParseDocs.Models;

public record Item(string Slug, string Name, int SinkPoints, List<string> UsedInRecipes, List<string> ProducedFromRecipes, bool IsFicsmas);