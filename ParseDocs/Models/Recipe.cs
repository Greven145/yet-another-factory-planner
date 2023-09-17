namespace ParseDocs.Models;

public record Recipe(string Slug, string Name, bool IsAlternate, List<ItemPerMinute> Ingredients, List<ItemPerMinute> Products, string ProducedIn, bool IsFicsmas );