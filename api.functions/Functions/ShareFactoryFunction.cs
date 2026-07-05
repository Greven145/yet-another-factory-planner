using System.Text.Json;
using api.functions.Services;
using api.Models;
using api.Services;
using FluentValidation;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace api.functions.Functions;

/// <summary>
/// POST /api/share-factory — validates a factory config, computes its content-hash id, persists it
/// (idempotently), and returns <c>201 { "data": { "key": "&lt;16hex&gt;" } }</c>. Mirrors the retired
/// api.web MapPost("/share-factory").
/// </summary>
public class ShareFactoryFunction(
    FactoryClient factoryClient,
    IValidator<FactoryConfigSchema> validator,
    JsonSerializerOptions jsonOptions,
    ILogger<ShareFactoryFunction> logger)
{
    [Function("ShareFactory")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "share-factory")] HttpRequest req,
        CancellationToken ct)
    {
        try
        {
            var request = await JsonSerializer.DeserializeAsync<ShareFactoryRequest>(req.Body, jsonOptions, ct);
            var config = request?.FactoryConfig;

            if (config is null)
                return JsonResponse.Build(new { message = "Missing factoryConfig." }, StatusCodes.Status400BadRequest, jsonOptions);

            var validation = await validator.ValidateAsync(config, ct);
            if (!validation.IsValid)
                return JsonResponse.Build(
                    new { message = string.Join(".", validation.Errors.Select(e => e.ErrorMessage)) },
                    StatusCodes.Status400BadRequest, jsonOptions);

            config.Id = ShareFactoryId.Compute(config);

            var key = await factoryClient.FindOrSaveAsync(config, ct);

            return JsonResponse.Build(new { data = new { key } }, StatusCodes.Status201Created, jsonOptions);
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Malformed share-factory request body");
            return JsonResponse.Build(new { message = "Invalid request body." }, StatusCodes.Status400BadRequest, jsonOptions);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to share factory");
            return JsonResponse.Build(
                new { message = "An error occurred while sharing the factory." },
                StatusCodes.Status500InternalServerError, jsonOptions);
        }
    }
}
