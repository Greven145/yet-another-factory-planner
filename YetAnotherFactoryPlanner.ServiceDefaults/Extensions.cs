using Azure.Monitor.OpenTelemetry.AspNetCore;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.ServiceDiscovery;
using OpenTelemetry;
using OpenTelemetry.Metrics;
using OpenTelemetry.Trace;

namespace Microsoft.Extensions.Hosting;

// Adds common Aspire services: service discovery, resilience, health checks, and OpenTelemetry.
// This project should be referenced by each service project in your solution.
// To learn more about using this project, see https://aka.ms/dotnet/aspire/service-defaults
public static class Extensions
{
    private const string HealthEndpointPath = "/health";
    private const string AlivenessEndpointPath = "/alive";

    public static TBuilder AddServiceDefaults<TBuilder>(this TBuilder builder) where TBuilder : IHostApplicationBuilder
    {
        builder.ConfigureOpenTelemetry();

        builder.AddDefaultHealthChecks();

        builder.Services.AddServiceDiscovery();

        builder.Services.ConfigureHttpClientDefaults(http =>
        {
            // Turn on resilience by default
            http.AddStandardResilienceHandler();

            // Turn on service discovery by default
            http.AddServiceDiscovery();
        });

        // Uncomment the following to restrict the allowed schemes for service discovery.
        // builder.Services.Configure<ServiceDiscoveryOptions>(options =>
        // {
        //     options.AllowedSchemes = ["https"];
        // });

        return builder;
    }

    public static TBuilder ConfigureOpenTelemetry<TBuilder>(this TBuilder builder) where TBuilder : IHostApplicationBuilder
    {
        builder.Logging.AddOpenTelemetry(logging =>
        {
            logging.IncludeFormattedMessage = true;
            logging.IncludeScopes = true;
        });

        builder.Services.AddOpenTelemetry()
            .WithMetrics(metrics =>
            {
                metrics.AddAspNetCoreInstrumentation()
                    .AddHttpClientInstrumentation()
                    .AddRuntimeInstrumentation();
            })
            .WithTracing(tracing =>
            {
                tracing.AddSource(builder.Environment.ApplicationName)
                    .AddAspNetCoreInstrumentation(tracing =>
                        // Exclude health check requests from tracing
                        tracing.Filter = context =>
                            !context.Request.Path.StartsWithSegments(HealthEndpointPath)
                            && !context.Request.Path.StartsWithSegments(AlivenessEndpointPath)
                    )
                    // Uncomment the following line to enable gRPC instrumentation (requires the OpenTelemetry.Instrumentation.GrpcNetClient package)
                    //.AddGrpcClientInstrumentation()
                    .AddHttpClientInstrumentation();
            });

        builder.AddOpenTelemetryExporters();

        return builder;
    }

    private static TBuilder AddOpenTelemetryExporters<TBuilder>(this TBuilder builder) where TBuilder : IHostApplicationBuilder
    {
        var useOtlpExporter = !string.IsNullOrWhiteSpace(builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"]);

        if (useOtlpExporter)
        {
            builder.Services.AddOpenTelemetry().UseOtlpExporter();
        }

        if (!string.IsNullOrEmpty(builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"]))
        {
            builder.Services.AddOpenTelemetry()
               .UseAzureMonitor();
        }

        return builder;
    }

    public static TBuilder AddDefaultHealthChecks<TBuilder>(this TBuilder builder) where TBuilder : IHostApplicationBuilder
    {
        builder.Services.AddHealthChecks()
            // Add a default liveness check to ensure app is responsive
            .AddCheck("self", () => HealthCheckResult.Healthy(), ["live"]);

        // The Aspire EF Core Cosmos integration (builder.AddCosmosDbContext<T>(...)) does
        // NOT automatically register a health check. We add one here, tagged "ready", so that
        // GET /health (the readiness probe) surfaces Cosmos connectivity without crashing the
        // app if Cosmos is briefly unavailable — it reports Unhealthy rather than throwing.
        // GET /alive (liveness) only runs checks tagged "live" and is unaffected.
        //
        // The concrete DbContext type is discovered by scanning the service descriptors inside
        // the HealthCheckRegistration factory delegate (service descriptors are final by the
        // time the factory runs, because the host builds the DI container after all
        // builder.Services calls complete). This avoids coupling ServiceDefaults to
        // the concrete FactoryDbContext type defined in api.web.
        var services = builder.Services;
        builder.Services.AddHealthChecks()
            .Add(new HealthCheckRegistration(
                name: "cosmos",
                factory: sp =>
                {
                    var dbContextType = services
                        .Select(sd => sd.ServiceType)
                        .FirstOrDefault(t => t != typeof(DbContext) && typeof(DbContext).IsAssignableFrom(t));
                    return new CosmosHealthCheck(sp.GetRequiredService<IServiceScopeFactory>(), dbContextType);
                },
                failureStatus: HealthStatus.Unhealthy,
                tags: ["ready"]));

        return builder;
    }

    public static WebApplication MapDefaultEndpoints(this WebApplication app)
    {
        // Health check endpoints are mapped in all environments to support ACA liveness and readiness probes.
        // All health checks must pass for app to be considered ready to accept traffic after starting
        app.MapHealthChecks(HealthEndpointPath);

        // Only health checks tagged with the "live" tag must pass for app to be considered alive
        app.MapHealthChecks(AlivenessEndpointPath, new HealthCheckOptions
        {
            Predicate = r => r.Tags.Contains("live")
        });

        return app;
    }
}

/// <summary>
/// Readiness health check that verifies Cosmos DB connectivity via the registered EF Core DbContext.
/// Reports <see cref="HealthCheckResult.Unhealthy"/> when Cosmos is unreachable rather than
/// throwing, so the ACA readiness probe receives a clean 503 instead of an unhandled exception.
/// Liveness (GET /alive) is unaffected — it only runs checks tagged "live".
/// </summary>
internal sealed class CosmosHealthCheck(IServiceScopeFactory scopeFactory, Type? dbContextType) : IHealthCheck
{
    private readonly Type? _dbContextType = dbContextType;

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        if (_dbContextType is null)
            return HealthCheckResult.Degraded("No DbContext is registered; Cosmos connectivity cannot be verified.");

        try
        {
            // Create a fresh scope so we don't capture a long-lived DbContext.
            await using var scope = scopeFactory.CreateAsyncScope();
            var dbContext = (DbContext)scope.ServiceProvider.GetRequiredService(_dbContextType);
            var canConnect = await dbContext.Database.CanConnectAsync(cancellationToken);
            return canConnect
                ? HealthCheckResult.Healthy("Cosmos DB is reachable.")
                : HealthCheckResult.Unhealthy("Cosmos DB connection check returned false.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Cosmos DB is unreachable.", ex);
        }
    }
}
