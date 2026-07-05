using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

namespace api.functions.Functions;

/// <summary>
/// Builds an <see cref="IActionResult"/> whose body is serialized with the app's shared camelCase
/// System.Text.Json options. Serializing explicitly (rather than via an OkObjectResult and the MVC
/// JSON layer) keeps the wire shape a guaranteed, self-contained contract — the response envelope
/// keys (<c>data</c>, <c>key</c>, <c>factory_config</c>, <c>message</c>) and the camelCase factory
/// fields are exactly what the client hooks expect.
/// </summary>
internal static class JsonResponse
{
    public static IActionResult Build(object body, int statusCode, JsonSerializerOptions options) =>
        new ContentResult
        {
            Content = JsonSerializer.Serialize(body, options),
            ContentType = "application/json",
            StatusCode = statusCode,
        };
}
