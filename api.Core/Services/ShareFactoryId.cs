using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using api.Models;

namespace api.Services;

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
    // Amplification and building-selection are appended to the canonical ONLY when set (see below).
    // WhenWritingNull then omits the default cases so that pre-feature configs serialize to the exact
    // historical bytes and keep their original id — no existing share link or dedup entry is orphaned.
    // No pre-existing canonical field is ever null, so this option is a no-op for them.
    private static readonly JsonSerializerOptions CanonicalOptions =
        new() { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };

    /// <summary>Produces the deterministic canonical JSON used as the hash input.</summary>
    public static string Canonicalize(FactoryConfigSchema config)
    {
        // These fields were added after the original wire contract. They affect the factory's identity
        // (a different boost budget or building restriction is a genuinely different factory), so they
        // must be hashed — otherwise distinct factories would collide on the same id and be deduped.
        // They are included only when non-default so the ids of every pre-feature config stay stable.
        var amp = config.AmplificationOptions;
        var hasAmp = amp is not null && (amp.AvailableSloops != 0 || amp.AvailableShards != 0);
        var hasBuildings = config.AllowedBuildings.Count > 0;

        return JsonSerializer.Serialize(new
        {
            gameVersion = config.GameVersion,
            productionItems = config.ProductionItems.OrderBy(x => x.ItemKey).ThenBy(x => x.Mode).ThenBy(x => x.Value),
            inputItems = config.InputItems.OrderBy(x => x.ItemKey),
            inputResources = config.InputResources.OrderBy(x => x.ItemKey),
            allowedRecipes = config.AllowedRecipes.OrderBy(x => x),
            weightingOptions = config.WeightingOptions,
            gameModeOptions = config.GameModeOptions,
            allowHandGatheredItems = config.AllowHandGatheredItems,
            amplificationOptions = hasAmp ? amp : null,
            allowedBuildings = hasBuildings ? config.AllowedBuildings.OrderBy(x => x) : null,
        }, CanonicalOptions);
    }

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
