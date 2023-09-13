using api.Extensions;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace api;

public class Ping {
    [Function(nameof(Ping))]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ping")]
        HttpRequestData req, CancellationToken cancellationToken) =>
        await req.CreateResponseAsync(new { data = new { message = "pong" } }, cancellationToken);
}