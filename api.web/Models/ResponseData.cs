using System.Net;

namespace api.Models;

public sealed record ResponseData(HttpStatusCode Code, string MimeType, string GameData);