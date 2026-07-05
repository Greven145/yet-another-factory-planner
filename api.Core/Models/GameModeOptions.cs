namespace api.Models;

// 1.2 Game Mode cost multipliers. Defaults of 1 mean "default game mode" (no scaling).
public record GameModeOptions(decimal RecipePartsCost, decimal PowerConsumption);
