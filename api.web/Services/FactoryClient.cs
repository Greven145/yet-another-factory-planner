using System.Net;
using api.Models;
using api.web.Data;
using Microsoft.Azure.Cosmos;
using Microsoft.EntityFrameworkCore;
using OneOf;
using OneOf.Types;

namespace api.web.Services;

public sealed class FactoryClient(FactoryDbContext dbContext, ILogger<FactoryClient> logger)
{
    internal async Task SaveFactoryAsync(FactoryConfigSchema factoryConfig)
    {
        if (string.IsNullOrEmpty(factoryConfig.Id))
            factoryConfig.Id = Guid.NewGuid().ToString("N");

        dbContext.Factories.Add(factoryConfig);
        await dbContext.SaveChangesAsync();
    }

    /// <summary>
    /// Returns the key for an existing factory with the same ID, or saves the new one
    /// and returns its key. This makes POST /share-factory idempotent for identical configs.
    /// </summary>
    internal async Task<string> FindOrSaveAsync(FactoryConfigSchema config, CancellationToken cancellationToken = default)
    {
        var normalizedVersion = NormalizeGameVersion(config.GameVersion);

        var existing = await dbContext.Factories
            .Where(f => f.Id == config.Id && f.GameVersion == normalizedVersion)
            .FirstOrDefaultAsync(cancellationToken);

        if (existing is not null)
            return existing.Id!;

        config.GameVersion = normalizedVersion;
        dbContext.Factories.Add(config);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            return config.Id!;
        }
        catch (DbUpdateException ex) when (ex.InnerException is CosmosException { StatusCode: HttpStatusCode.Conflict })
        {
            // Another concurrent request inserted the same entity; re-query and return its Id.
            var conflict = await dbContext.Factories
                .Where(f => f.Id == config.Id && f.GameVersion == normalizedVersion)
                .FirstOrDefaultAsync(cancellationToken);

            return conflict!.Id!;
        }
    }

    internal async Task<GetFactoryResult> GetFactory(string factoryKey, string gameVersion,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var normalizedVersion = NormalizeGameVersion(gameVersion);

            var factory = await dbContext.Factories
                .Where(f => f.Id == factoryKey && f.GameVersion == normalizedVersion)
                .FirstOrDefaultAsync(cancellationToken);

            return factory is not null ? (GetFactoryResult)factory : new None();
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            logger.LogWarning(ex, "Factory {FactoryKey} not found in Cosmos", factoryKey);
            return new None();
        }
    }

    private static string NormalizeGameVersion(string gameVersion) => gameVersion switch
    {
        "1.1" => "V1_1",
        "V1_1" => "V1_1",
        _ => gameVersion,
    };
}

[GenerateOneOf]
public partial class GetFactoryResult : OneOfBase<FactoryConfigSchema, None>
{
}
