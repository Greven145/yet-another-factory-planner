using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using ParseDocs.Serializers;

namespace ParseDocs; 

internal static class ParsedDocs
{
    private static readonly JsonSerializerOptions Options = new() {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        Converters = {
            new JsonStringEnumConverter(),
            new DecimalJsonConverter()
        },
        WriteIndented = false
    };

    public static async Task<Dictionary<string, T>> Load<T>(string path)
    {
        using var buildablesText = new StreamReader(path);
        return
            (await JsonSerializer.DeserializeAsync<Dictionary<string, T>>(buildablesText.BaseStream,
                Options))!;
    }
    
    public static async Task Save<T>(string path, Dictionary<string, T> data)
    {
        await using var file = File.CreateText(path);
        await JsonSerializer.SerializeAsync(file.BaseStream, data, Options);
    }
}