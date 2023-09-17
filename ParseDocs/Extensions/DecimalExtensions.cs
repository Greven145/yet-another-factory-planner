namespace ParseDocs.Extensions; 

internal static class DecimalExtensions
{
    public static decimal Normalize(this decimal value) =>
        value / 1.000000000000000000000000000000000m;
}