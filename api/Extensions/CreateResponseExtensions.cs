using System.Net;
using api.Models;
using Microsoft.Azure.Functions.Worker.Http;

namespace api.Extensions;

internal static class CreateResponseExtensions {
    internal static async Task<HttpResponseData> CreateResponseAsync(this HttpRequestData req, object body,
        CancellationToken cancellationToken = default) {
        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(body, cancellationToken);
        return response;
    }

    internal static async Task<HttpResponseData> CreateCreatedResponseAsync(this HttpRequestData req, object body,
        CancellationToken cancellationToken = default) {
        var response = req.CreateResponse();
        await response.WriteAsJsonAsync(body, HttpStatusCode.Created, cancellationToken);
        return response;
    }

    internal static async Task<HttpResponseData> CreateBadRequestResponseAsync(this HttpRequestData req, object body,
        CancellationToken cancellationToken = default) {
        var response = req.CreateResponse();
        await response.WriteAsJsonAsync(body, HttpStatusCode.BadRequest, cancellationToken);
        return response;
    }

    internal static HttpResponseData CreateInternalServerErrorResponseAsync(this HttpRequestData req) =>
        req.CreateResponse(HttpStatusCode.InternalServerError);

    internal static async Task<HttpResponseData> CreateResponseFromDataAsync(this HttpRequestData req,
        ResponseData data, CancellationToken cancellationToken = default) {
        var response = req.CreateResponse(data.Code);
        response.Headers.Add("Content-Type", $"{data.MimeType}; charset=utf-8");
        await response.WriteStringAsync(data.GameData, cancellationToken);
        return response;
    }
}