using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;

namespace api;

public class Ping {
    [Function(nameof(Ping))]
    public IActionResult Run([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "ping")] HttpRequest _) =>
        new OkObjectResult(new { message = "Pong" });
}