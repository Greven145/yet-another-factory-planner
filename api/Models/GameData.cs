using api.Resources;

namespace api.Models;

public sealed record GameData(string Buildings, string Recipes, string Resources, string Items,
    string HandGatheredItems) {
#pragma warning disable CA1707 // Keep underscore to match external game version identifier.
    public static readonly GameData V1_1Data = new(V1_1.buildings, V1_1.recipes, V1_1.resources, V1_1.items,
        V1_1.handGatheredItems);
#pragma warning restore CA1707
}