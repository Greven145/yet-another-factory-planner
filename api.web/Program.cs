using FluentValidation;
using api.Models;
using api.Validation;
using api.web.Services;
using api.web.Data;
using api.web.Resources;

var builder = WebApplication.CreateBuilder(args);

// CORS: allow specific origins when configured, otherwise allow all.
// In production, set "AllowedOrigins" in config/env to restrict to known client URLs.
// Without that setting (dev / integration-test environments) wildcard is intentional.
var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", policy =>
    {
        if (allowedOrigins.Length > 0)
            policy.WithOrigins(allowedOrigins).AllowAnyMethod().AllowAnyHeader();
        else
            policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
    });
});

builder.Services.AddValidatorsFromAssemblyContaining<FactoryConfigSchemaValidator>();
builder.Services.AddHttpClient();

builder.AddCosmosDbContext<FactoryDbContext>("cosmos-db", "shared-factory");

builder.Services.AddScoped<FactoryClient>();

var app = builder.Build();

app.UseCors("CorsPolicy");

app.MapGet("/ping", () => Results.Ok(new { data = new { message = "pong" } }))
    .WithName("Ping");

app.MapGet("/initialize", async (
    string? gameVersion,
    string? factoryKey,
    FactoryClient factoryClient,
    ILogger<Program> logger,
    CancellationToken cancellationToken) =>
{
    try
    {
        gameVersion ??= "1.1";

        var gameDataDict = new Dictionary<string, object>();

        var buildings = V1_1.buildings;
        var recipes = V1_1.recipes;
        var resources = V1_1.resources;
        var items = V1_1.items;
        var handGatheredItems = V1_1.handGatheredItems;

        if (!string.IsNullOrEmpty(buildings))
            gameDataDict["buildings"] = System.Text.Json.JsonSerializer.Deserialize<object>(buildings)!;
        if (!string.IsNullOrEmpty(recipes))
            gameDataDict["recipes"] = System.Text.Json.JsonSerializer.Deserialize<object>(recipes)!;
        if (!string.IsNullOrEmpty(resources))
            gameDataDict["resources"] = System.Text.Json.JsonSerializer.Deserialize<object>(resources)!;
        if (!string.IsNullOrEmpty(items))
            gameDataDict["items"] = System.Text.Json.JsonSerializer.Deserialize<object>(items)!;
        if (!string.IsNullOrEmpty(handGatheredItems))
            gameDataDict["handGatheredItems"] = System.Text.Json.JsonSerializer.Deserialize<object>(handGatheredItems)!;

        var responseData = new Dictionary<string, object> { { "game_data", gameDataDict } };

        if (!string.IsNullOrEmpty(factoryKey))
        {
            var result = await factoryClient.GetFactory(factoryKey, gameVersion, cancellationToken);

            var found = false;
            result.Switch(
                factory =>
                {
                    var options = new System.Text.Json.JsonSerializerOptions { PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase };
                    var factoryJson = System.Text.Json.JsonSerializer.Serialize(factory, options);
                    responseData["factory_config"] = System.Text.Json.JsonSerializer.Deserialize<object>(factoryJson)!;
                    found = true;
                },
                none => { }
            );

            if (!found)
                return Results.NotFound(new { message = "Factory not found" });
        }

        return Results.Ok(new { data = responseData });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to initialize");
        return Results.Problem("An error occurred while initializing.", statusCode: 500);
    }
})
    .WithName("Initialize");

app.MapPost("/share-factory", async (
    ShareFactoryRequest request,
    IValidator<FactoryConfigSchema> validator,
    FactoryClient factoryClient,
    ILogger<Program> logger,
    CancellationToken cancellationToken) =>
{
    try
    {
        var config = request.FactoryConfig;
        var validationResult = await validator.ValidateAsync(config);

        if (!validationResult.IsValid)
            return Results.BadRequest(new { message = string.Join(".", validationResult.Errors.Select(x => x.ErrorMessage)) });

        var canonical = System.Text.Json.JsonSerializer.Serialize(new
        {
            gameVersion = config.GameVersion,
            productionItems = config.ProductionItems.OrderBy(x => x.ItemKey).ThenBy(x => x.Mode).ThenBy(x => x.Value),
            inputItems = config.InputItems.OrderBy(x => x.ItemKey),
            inputResources = config.InputResources.OrderBy(x => x.ItemKey),
            allowedRecipes = config.AllowedRecipes.OrderBy(x => x),
            weightingOptions = config.WeightingOptions,
            allowHandGatheredItems = config.AllowHandGatheredItems,
        });
        var hash = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(canonical));
        var factoryId = Convert.ToHexString(hash)[..16].ToLowerInvariant();
        config.Id = factoryId;

        var key = await factoryClient.FindOrSaveAsync(config, cancellationToken);

        return Results.Created($"/get-factory?factoryKey={key}&gameVersion={config.GameVersion}", new { data = new { key } });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to share factory");
        return Results.Problem("An error occurred while sharing the factory.", statusCode: 500);
    }
})
    .WithName("ShareFactory");

app.MapGet("/get-factory", async (
    string factoryKey,
    string? gameVersion,
    FactoryClient factoryClient,
    ILogger<Program> logger,
    CancellationToken cancellationToken) =>
{
    try
    {
        var result = await factoryClient.GetFactory(factoryKey, gameVersion ?? "1.1", cancellationToken);

        return result.Match(
            factory => Results.Ok(new { factory }),
            none => Results.NotFound(new { message = "Factory not found" })
        );
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to retrieve factory {FactoryKey}", factoryKey);
        return Results.Problem("An error occurred while retrieving the factory.", statusCode: 500);
    }
})
    .WithName("GetFactory");

app.Run();

public record ShareFactoryRequest(FactoryConfigSchema FactoryConfig);
