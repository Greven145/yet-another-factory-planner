using api.web.Resources;

namespace api.Models;

public sealed record GameData(string Buildings, string Recipes, string Resources, string Items,
    string HandGatheredItems) {
#pragma warning disable CA1707 // Keep underscore to match external game version identifier.
    public static readonly GameData V1_1Data = new(api.web.Resources.V1_1.buildings, api.web.Resources.V1_1.recipes, api.web.Resources.V1_1.resources, api.web.Resources.V1_1.items,
        api.web.Resources.V1_1.handGatheredItems);
#pragma warning restore CA1707
}