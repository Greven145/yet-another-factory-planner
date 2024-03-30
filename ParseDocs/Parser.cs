using ParseDocs.Models;

namespace ParseDocs; 

public static class Parser {
    public static async Task Run(DirectoryInfo input, DirectoryInfo output)
    {
        var buildables = await ParsedDocs.Load<BuildableInfo>($"{input.FullName}/buildables.json");
        var recipes = await ParsedDocs.Load<ProductionRecipeInfo>($"{input.FullName}/productionRecipes.json");
        var resources = await ParsedDocs.Load<ResourceInfo>($"{input.FullName}/resources.json");
        var items = await ParsedDocs.Load<ItemInfo>($"{input.FullName}/items.json");
        var buildableRecipes = await ParsedDocs.Load<BuildableRecipeInfo>($"{input.FullName}/buildableRecipes.json");

        var buildingsOutput = new Dictionary<string, Building>();
        var nonExtractorBuildables =
            buildables.Where(b => b.Value.IsProduction || b.Value.IsGenerator || b.Value.IsResourceExtractor);

        foreach (var (buildingKey, buildingData) in nonExtractorBuildables)
        {
            var power = 0m;
            if (buildingData.Meta?.GeneratorInfo is not null)
            {
                power = -buildingData.Meta.GeneratorInfo.PowerProduction;
            }
            else if (buildingData.Meta?.PowerInfo is not null)
            {
                power = buildingData.Meta.PowerInfo.Consumption;
            }

            var area = 0m;
            if (buildingData.Meta?.Size is not null)
            {
                area = buildingData.Meta.Size.Width * buildingData.Meta.Size.Length;
            }

            var recipeData = buildableRecipes.Values.FirstOrDefault(br => br.Product == buildingKey);
            var buildCost = recipeData?.Ingredients ?? new List<ItemQuantity>();
            if (buildCost.Count == 0)
            {
                Console.WriteLine($"Building {buildingKey} HAS NOT BUILD COST");
            }

            buildingsOutput.Add(buildingKey,
                new Building(buildingData.Slug.Replace('-', '_'), buildingData.Name, power, area, buildCost,
                    buildingData.Event == EventType.Ficsmas));
        }

        var recipesOutput = new Dictionary<string, Recipe>();
        foreach (var (recipeKey, recipeData) in recipes.Where(r => !string.IsNullOrEmpty(r.Value.ProducedIn)))
        {
            var ingredients = recipeData.Ingredients
                .Select(i => new ItemPerMinute(i.ItemClass, 60 * i.Quantity / recipeData.CraftTime)).ToList();
            var products = recipeData.Products
                .Select(p => new ItemPerMinute(p.ItemClass, 60 * p.Quantity / recipeData.CraftTime)).ToList();
            recipesOutput.Add(recipeKey,
                new Recipe(recipeData.Slug.Replace('-', '_'), recipeData.Name, recipeData.IsAlternate, ingredients, products,
                    recipeData.ProducedIn, recipeData.Event == EventType.Ficsmas));
        }

        recipesOutput.Add("Recipe_CUSTOM_NuclearPower_C",
            new Recipe("uranium_power_recipe", "Uranium Power", false,
                new List<ItemPerMinute> { new("Desc_NuclearFuelRod_C", 0.2m), new("Desc_Water_C", 240) },
                new List<ItemPerMinute> { new("Desc_NuclearWaste_C", 10) }, "Desc_GeneratorNuclear_C", false));
        recipesOutput.Add("Recipe_CUSTOM_PlutoniumPower_C",
            new Recipe("plutonium_power_recipe", "Plutonium Power", false,
                new List<ItemPerMinute> { new("Desc_PlutoniumFuelRod_C", 0.1m), new("Desc_Water_C", 240) },
                new List<ItemPerMinute> { new("Desc_PlutoniumWaste_C", 1) }, "Desc_GeneratorNuclear_C", false));

        var resourcesOutput = new Dictionary<string, Resource>();
        var maxExtraction = 0d;
        foreach (var (resourceKey, resourceData) in resources)
        {
            if (resourceData.MaxExtraction is not null && resourceData.MaxExtraction > maxExtraction)
            {
                maxExtraction = resourceData.MaxExtraction.Value;
            }

            resourcesOutput.Add(resourceKey, new Resource(resourceData.ItemClass, resourceData.MaxExtraction, 1));
        }

        foreach (var resource in resourcesOutput.Values.Where(resource => resource.MaxExtraction is not null))
        {
            resource.RelativeValue = Math.Floor(maxExtraction / resource.MaxExtraction!.Value * 100);
        }

        var itemOutput = new Dictionary<string, Item>();
        var handGatheredItems = new Dictionary<string, string>();
        foreach (var (itemKey, itemData) in items)
        {
            var usedInRecipes = recipesOutput.Where(r => r.Value.Ingredients.Exists(p => p.ItemClass == itemKey))
                .Select(r => r.Key).ToList();
            var producedFromRecipes = recipesOutput.Where(r => r.Value.Products.Exists(p => p.ItemClass == itemKey))
                .Select(r => r.Key).ToList();

            if (usedInRecipes.Count == 0 && producedFromRecipes.Count == 0)
            {
                continue;
            }

            if (producedFromRecipes.Count == 0 && !resourcesOutput.ContainsKey(itemKey))
            {
                handGatheredItems.Add(itemKey, itemKey);
            }

            itemOutput.Add(itemKey,
                new Item(itemData.Slug.Replace('-', '_'), itemData.Name, itemData.IsFluid ? 0 : itemData.SinkPoints,
                    usedInRecipes, producedFromRecipes, itemData.Event == EventType.Ficsmas));
        }

await Task.WhenAll(ParsedDocs.Save($"{output.FullName}/buildings.json", buildingsOutput),
            ParsedDocs.Save($"{output.FullName}/recipes.json", recipesOutput),
            ParsedDocs.Save($"{output.FullName}/resources.json", resourcesOutput),
            ParsedDocs.Save($"{output.FullName}/items.json", itemOutput),
            ParsedDocs.Save($"{output.FullName}/handGatheredItems.json", handGatheredItems));
        Console.WriteLine($"Data written to {output.FullName}");
    }
}