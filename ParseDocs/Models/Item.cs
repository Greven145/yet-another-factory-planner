namespace ParseDocs.Models;

public record Item(string Slug, string Name, int SinkPoints, bool IsFluid, List<string> UsedInRecipes, List<string> ProducedFromRecipes, bool IsFicsmas);