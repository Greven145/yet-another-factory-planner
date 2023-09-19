using api.Resources;

namespace api.Models;

public sealed record GameData(string Buildings, string Recipes, string Resources, string Items,
    string HandGatheredItems) {
    public static readonly GameData U5Data = new(U5.buildings, U5.recipes, U5.resources, U5.items,
        U5.handGatheredItems);

    public static readonly GameData U6Data = new(U6.buildings, U6.recipes, U6.resources, U6.items,
        U6.handGatheredItems);

    public static readonly GameData U7Data = new(U7.buildings, U7.recipes, U7.resources, U7.items,
        U7.handGatheredItems);

    public static readonly GameData U8Data = new(U8.buildings, U8.recipes, U8.resources, U8.items,
        U8.handGatheredItems);
}