using api.Models;

namespace api.Services;

/// <summary>
/// The single source of truth for the share-factory game-version vocabulary.
///
/// Two forms exist on the wire: the client-facing display string ("1.1", "1.2")
/// and the internal enum name ("V1_1", "V1_2"). Every server site that needs to
/// validate, normalize, or recognize a game version goes through here so the
/// vocabulary lives in exactly one place.
/// </summary>
public static class GameVersions
{
    /// <summary>Maps a display string (or an already-normalized enum name) to the canonical enum name.</summary>
    private static readonly Dictionary<string, string> DisplayToEnumName = new()
    {
        ["1.1"] = "V1_1",
        ["1.2"] = "V1_2",
    };

    /// <summary>Default version used when a request omits one.</summary>
    public const string DefaultDisplay = "1.2";

    /// <summary>
    /// Every value accepted as a valid game version: the enum names plus the
    /// client-facing display strings. Used by the validator's whitelist.
    /// </summary>
    public static readonly IReadOnlySet<string> Valid = new HashSet<string>(
        Enum.GetNames<GameVersion>().Concat(DisplayToEnumName.Keys));

    /// <summary>
    /// Normalizes any accepted form to the internal enum name ("1.1"/"V1_1" -> "V1_1").
    /// Unknown values pass through unchanged, preserving prior behavior.
    /// </summary>
    public static string Normalize(string gameVersion) =>
        DisplayToEnumName.TryGetValue(gameVersion, out var enumName) ? enumName : gameVersion;
}
