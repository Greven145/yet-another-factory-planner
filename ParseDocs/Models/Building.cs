namespace ParseDocs.Models;

public record Building(string Slug, string Name, decimal Power, decimal Area, IEnumerable<ItemQuantity> BuildCost, bool IsFicsmas);