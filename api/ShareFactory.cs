using api.Models;
using FluentValidation;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using NanoidDotNet;

namespace api;

public class ShareFactory(IValidator<FactoryConfigSchema> validator, FactoryClient factoryClient) {
    [Function(nameof(ShareFactory))]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "share-factory")]
        HttpRequest _,
        [Microsoft.Azure.Functions.Worker.Http.FromBody] ShareFactoryRequest factoryConfig,
        CancellationToken cancellationToken) {

        if (factoryConfig is not { FactoryConfig: not null }) {
            return new BadRequestObjectResult(new { message = "Invalid request body" });
        }

        var validationResult = await validator.ValidateAsync(factoryConfig.FactoryConfig, cancellationToken);

        if (!validationResult.IsValid) {
            return new BadRequestObjectResult(
                new { message = string.Join('.', validationResult.Errors.Select(x => x.ErrorMessage)) });
        }

        var factoryId = await Nanoid.GenerateAsync();

        await factoryClient.SaveFactory(factoryConfig.FactoryConfig with { Id = factoryId }, cancellationToken);

        return new CreatedResult($"initialize?factoryKey={factoryId}", new { data = new { key = factoryId } });
    }
}