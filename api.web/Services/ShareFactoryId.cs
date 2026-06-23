using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using api.Models;

namespace api.web.Services;

/// <summary>
/// The single agreed rule for turning a factory config into its share id.
///
/// The id is a content hash: the config is canonicalized (fields sorted into a
/// deterministic order), serialized to JSON, SHA256-hashed, and truncated to the
/// first 16 hex characters. Identical configs therefore always produce the same
/// id, which makes POST /share-factory idempotent and lets existing share links
/// keep resolving. This algorithm is a wire contract — changing it would orphan
/// every previously generated share link, so it must stay byte-for-byte stable.
/// </summary>
public static class ShareFactoryId
{
    /// <summary>Produces the deterministic canonical JSON used as the hash input.</summary>
    public static string Canonicalize(FactoryConfigSchema config) =>
        JsonSerializer.Serialize(new
        {
            gameVersion = config.GameVersion,
            productionItems = config.ProductionItems.OrderBy(x => x.ItemKey).ThenBy(x => x.Mode).ThenBy(x => x.Value),
            inputItems = config.InputItems.OrderBy(x => x.ItemKey),
            inputResources = config.InputResources.OrderBy(x => x.ItemKey),
            allowedRecipes = config.AllowedRecipes.OrderBy(x => x),
            weightingOptions = config.WeightingOptions,
            gameModeOptions = config.GameModeOptions,
            allowHandGatheredItems = config.AllowHandGatheredItems,
        });

    /// <summary>Computes the 16-hex-char share id for a config.</summary>
    public static string Compute(FactoryConfigSchema config)
    {
        var canonical = Canonicalize(config);
        // This ID is a content hash — deterministic and reproducible from the config alone.
        // It is NOT a secret: anyone who knows the factory config can compute the same ID.
        // It serves as a stable, short identifier for deduplication, not as an access-control mechanism.
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(canonical));
        return Convert.ToHexString(hash)[..16].ToLowerInvariant();
    }
}
