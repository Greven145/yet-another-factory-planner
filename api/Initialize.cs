using System.Net;
using System.Text.Json;
using api.Extensions;
using api.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Configuration;

namespace api;

public class Initialize {
    private readonly IConfiguration _configuration;
    private string _factoryData = "";
    private static readonly JsonSerializerOptions _jsonSerializerOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public Initialize(IConfiguration configuration) {
        _configuration = configuration;
    }

    [Function(nameof(Initialize))]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "initialize")]
        HttpRequestData req, CancellationToken cancellationToken) {
        var request = req.Query["gameVersion"] ?? "U8";
        var factoryKey = req.Query["factoryKey"];

        if (factoryKey is not null) {
            var factoryClient = new FactoryClient(_configuration);

            var result = await factoryClient.GetFactory(factoryKey, request, cancellationToken);
            result.Switch(
                factory => _factoryData = $"""
                                           "factory_config" : {JsonSerializer.Serialize(factory, _jsonSerializerOptions)},
                                           """,
                none => { }
            );
        }

        if (factoryKey is not null && _factoryData == "") {
            return await req.CreateBadRequestResponseAsync(new { message = "Invalid factory id" }, cancellationToken);
        }

        var responseData = request switch {
            "U5" => new ResponseData(HttpStatusCode.OK, "application/json", GetGameData(GameData.U5Data, _factoryData)),
            "U6" => new ResponseData(HttpStatusCode.OK, "application/json", GetGameData(GameData.U6Data, _factoryData)),
            "U7" => new ResponseData(HttpStatusCode.OK, "application/json", GetGameData(GameData.U7Data, _factoryData)),
            "U8" => new ResponseData(HttpStatusCode.OK, "application/json", GetGameData(GameData.U8Data, _factoryData)),
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