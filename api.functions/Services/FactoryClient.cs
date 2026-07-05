using System.Net;
using api.Models;
using api.Services;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Logging;

namespace api.functions.Services;

/// <summary>
/// Persists and resolves shared factory configs against Cosmos DB using the raw
/// <see cref="CosmosClient"/> (no EF Core). Container <c>factories</c> in database
/// <c>shared-factory</c>, partition key <c>/gameVersion</c>.
/// </summary>
public sealed class FactoryClient
{
    private const string DatabaseName = "shared-factory";
    private const string ContainerName = "factories";

    private readonly Container _container;
    private readonly ILogger<FactoryClient> _logger;

    public FactoryClient(CosmosClient cosmosClient, ILogger<FactoryClient> logger)
    {
        _container = cosmosClient.GetContainer(DatabaseName, ContainerName);
        _logger = logger;
    }

    /// <summary>
    /// Returns the id of an existing factory with the same content-hash id, or creates the new one
    /// and returns its id. This makes POST /api/share-factory idempotent for identical configs.
    /// A concurrent insert of the same id surfaces as a 409 Conflict; we re-read and return the
    /// existing id (preserving the idempotency guarantee of the old EF Core implementation).
    /// </summary>
    public async Task<string> FindOrSaveAsync(FactoryConfigSchema config, CancellationToken ct = default)
    {
        var version = GameVersions.Normalize(config.GameVersion);
        config.GameVersion = version;

        var existing = await ReadOrNullAsync(config.Id!, version, ct);
        if (existing is not null)
            return existing.Id!;

        try
        {
            await _container.CreateItemAsync(config, new PartitionKey(version), cancellationToken: ct);
            return config.Id!;
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.Conflict)
        {
            // Another concurrent request inserted the same entity; re-read and return its id.
            var conflict = await ReadOrNullAsync(config.Id!, version, ct);
            return conflict?.Id ?? config.Id!;
        }
    }

    /// <summary>
    /// Resolves a shared factory by its key alone, querying across partitions by <c>id</c>.
    ///
    /// The share-load path (GET /api/shared-factories/{key}) sends ONLY the key — no game version —
    /// but the partition key is <c>/gameVersion</c>, so a point read is impossible without the
    /// version. A cross-partition <c>SELECT * FROM c WHERE c.id = @id</c> lets a share link resolve
    /// regardless of the stored game version. (Behavior change: the retired /initialize share path
    /// defaulted the version to "1.2", so a shared 1.1 factory silently failed to resolve. Since the
    /// id is a content hash of a config that INCLUDES the game version, ids do not collide across
    /// versions, so an id-only lookup is unambiguous.)
    /// </summary>
    public async Task<FactoryConfigSchema?> GetByIdAsync(string id, CancellationToken ct = default)
    {
        var query = new QueryDefinition("SELECT * FROM c WHERE c.id = @id").WithParameter("@id", id);
        using var iterator = _container.GetItemQueryIterator<FactoryConfigSchema>(query);

        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(ct);
            foreach (var item in page)
                return item;
        }

        return null;
    }

    private async Task<FactoryConfigSchema?> ReadOrNullAsync(string id, string version, CancellationToken ct)
    {
        try
        {
            var response = await _container.ReadItemAsync<FactoryConfigSchema>(
                id, new PartitionKey(version), cancellationToken: ct);
            return response.Resource;
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }
}
