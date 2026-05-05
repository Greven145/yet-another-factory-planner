using api.Extensions;
using api.Models;
using api.Validation;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using NanoidDotNet;

namespace api;

public class ShareFactory {
    private readonly FactoryClient _factoryClient;

    public ShareFactory(FactoryClient factoryClient) {
        _factoryClient = factoryClient;
    }

    [Function(nameof(ShareFactory))]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "share-factory")]
        HttpRequestData req, CancellationToken cancellationToken) {
        if (req.Body.Length == 0) {
            return await req.CreateBadRequestResponseAsync(new { message = "Invalid request body" }, cancellationToken);
        }

        var factoryConfig = await req.ReadFromJsonAsync<ShareFactoryRequest>(cancellationToken);

        if (factoryConfig is not { FactoryConfig: not null }) {
            return await req.CreateBadRequestResponseAsync(new { message = "Invalid request body" }, cancellationToken);
        }

        var validator = new FactoryConfigSchemaValidator();
        var validationResult = await validator.ValidateAsync(factoryConfig.FactoryConfig, cancellationToken);

        if (!validationResult.IsValid) {
            return await req.CreateBadRequestResponseAsync(
                new { message = string.Join('.', validationResult.Errors.Select(x => x.ErrorMessage)) },
                cancellationToken);
        }

        var factoryId = await Nanoid.GenerateAsync();

        try
        {
            await _factoryClient.SaveFactory(factoryConfig.FactoryConfig with { Id = factoryId });
        }
        catch (Exception ex)
        {
            return await req.CreateBadRequestResponseAsync(new { message = $"Failed to save factory: {ex.Message}" }, cancellationToken);
        }

        return await req.CreateCreatedResponseAsync(new { data = new { key = factoryId } }, cancellationToken);
    }
}