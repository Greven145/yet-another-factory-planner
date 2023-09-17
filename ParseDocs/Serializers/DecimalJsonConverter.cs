using System.Text.Json;
using System.Text.Json.Serialization;
using ParseDocs.Extensions;
namespace ParseDocs.Serializers;

public class DecimalJsonConverter : JsonConverter<decimal> {
    public override decimal Read(
        ref Utf8JsonReader reader,
        Type typeToConvert,
        JsonSerializerOptions options) =>
        reader.GetDecimal().Normalize();

    public override void Write(
        Utf8JsonWriter writer,
        decimal value,
        JsonSerializerOptions options) =>
        writer.WriteNumberValue(value.Normalize());
}