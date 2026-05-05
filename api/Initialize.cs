using System.Net;
using System.Text.Json;
using api.Extensions;
using api.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace api;

public class Initialize {
    private static readonly JsonSerializerOptions JsonOptions = new() 
    { 
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase 
    };
    
    private readonly FactoryClient _factoryClient;
    private string _factoryData = "";

    public Initialize(FactoryClient factoryClient) {
        _factoryClient = factoryClient;
    }

    [Function(nameof(Initialize))]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "initialize")]
        HttpRequestData req, CancellationToken cancellationToken) {
        var request = req.Query["gameVersion"] ?? "1.1";
        var factoryKey = req.Query["factoryKey"];

        if (factoryKey is not null) {
            var result = await _factoryClient.GetFactory(factoryKey, request, cancellationToken);
            result.Switch(
                factory => _factoryData = $"""
                                           "factory_config" : {JsonSerializer.Serialize(factory, JsonOptions)},
                                           """,
                none => { }
            );
        }

        if (factoryKey is not null && _factoryData == "") {
            return await req.CreateBadRequestResponseAsync(new { message = "Invalid factory id" }, cancellationToken);
        }

        var responseData = request switch {
            "1.1" => new ResponseData(HttpStatusCode.OK, "application/json", GetGameData(GameData.V1_1Data, _factoryData)),
            _ => new ResponseData(HttpStatusCode.BadRequest, "text/plain", "Invalid game version")
        };

        return await req.CreateResponseFromDataAsync(responseData, cancellationToken);
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