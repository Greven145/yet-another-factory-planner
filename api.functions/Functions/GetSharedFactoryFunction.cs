using System.Text.Json;
using api.functions.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace api.functions.Functions;

/// <summary>
/// GET /api/shared-factories/{factoryKey} — resolves a shared factory by key alone (cross-partition
/// lookup by id) and returns <c>200 { "data": { "factory_config": &lt;camelCase config&gt; } }</c>,
/// or <c>404 { "message": "Factory not found" }</c>. Replaces the old /get-factory, which returned
/// the wrong shape (<c>{ factory }</c>).
/// </summary>
public class GetSharedFactoryFunction(
    FactoryClient factoryClient,
    JsonSerializerOptions jsonOptions,
    ILogger<GetSharedFactoryFunction> logger)
{
    [Function("GetSharedFactory")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "shared-factories/{factoryKey}")] HttpRequest req,
        string factoryKey,
        CancellationToken ct)
    {
        try
        {
            var factory = await factoryClient.GetByIdAsync(factoryKey, ct);

            if (factory is null)
                return JsonResponse.Build(new { message = "Factory not found" }, StatusCodes.Status404NotFound, jsonOptions);

            return JsonResponse.Build(new { data = new { factory_config = factory } }, StatusCodes.Status200OK, jsonOptions);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to retrieve factory {FactoryKey}", factoryKey.ReplaceLineEndings(string.Empty));
            return JsonResponse.Build(
                new { message = "An error occurred while retrieving the factory." },
                StatusCodes.Status500InternalServerError, jsonOptions);
        }
    }
}
