using System.Text.Json;
using api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;

namespace api;

public class Initialize(FactoryClient factoryClient) {
    private string _factoryData = "";
    private static readonly JsonSerializerOptions JsonSerializerOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    private static readonly List<string> GameVersions = ["U5", "U6", "U7", "U8"];

    [Function(nameof(Initialize))]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "initialize")]
        HttpRequest req, CancellationToken cancellationToken) {

        var request = req.Query.TryGetValue("gameVersion", out var requestValue) ? requestValue.ToString() : "U8";
        if (!GameVersions.Contains(request))
        {
            return new BadRequestObjectResult(new { message = "Invalid game version" });
        }

        var factoryKey = req.Query.TryGetValue("factoryKey", out var factoryKeyValue) ? factoryKeyValue.ToString() : null;
        if (factoryKey is not null) {
            var result = await factoryClient.GetFactory(factoryKey, request, cancellationToken);
            result.Switch(
                factory => _factoryData = $"""
                                           "factory_config" : {JsonSerializer.Serialize(factory, JsonSerializerOptions)},
                                           """,
                none => { }
            );

if (result.IsT1) {
                return new BadRequestObjectResult(new { message = "Invalid factory id" });
            }
        }

        var responseData = request switch
        {
            "U5" => GetGameData(GameData.U5Data, _factoryData),
            "U6" => GetGameData(GameData.U6Data, _factoryData),
            "U7" => GetGameData(GameData.U7Data, _factoryData),
            "U8" => GetGameData(GameData.U8Data, _factoryData),
            _ => throw new NotImplementedException()
        };

        return new ContentResult {
            StatusCode = StatusCodes.Status200OK,
            Content = responseData,
            ContentType = "application/json; charset=utf-8"
        };
    }

    private static string GetGameData(GameData gameData, string factoryConfig) =>
        $$"""
          {
              "data": {
                  {{factoryConfig}}
                  "game_data": {
                      "buildings": {{gameData.Buildings}},
                      "recipes": {{gameData.Recipes}},
                      "resources": {{gameData.Resources}},
                      "items": {{gameData.Items}},
                      "handGatheredItems": {{gameData.HandGatheredItems}}
                  }
              }
          }
          """;
}