using System.Diagnostics;
using api.web.Data;
using Microsoft.EntityFrameworkCore;

namespace api.web.Services;

/// <summary>
/// Hosted service that pre-pays Cosmos cold-start costs during host startup, BEFORE the app
/// reports "Application started" and begins accepting traffic. It forces the expensive
/// first-request work to happen during ACA activation: managed-identity IMDS token acquisition,
/// the Cosmos Direct-mode connection handshake, and the EF Core model build.
///
/// Implemented as <see cref="IHostedService"/> (not <c>BackgroundService</c>) so that
/// <see cref="StartAsync"/> runs inline during <c>IHost.StartAsync</c> and gates readiness.
///
/// Resilient by design: any failure (Cosmos unavailable, no emulator in local dev, timeout)
/// is logged and swallowed so the app still starts. The first real request then simply pays
/// the init cost it would have paid anyway.
/// </summary>
public sealed class CosmosWarmupService(
    IServiceScopeFactory scopeFactory,
    ILogger<CosmosWarmupService> logger) : IHostedService
{
    private static readonly TimeSpan WarmupTimeout = TimeSpan.FromSeconds(15);

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();

        // Cap warmup so it can never hang host startup indefinitely; still honors host shutdown.
        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(WarmupTimeout);
        var linkedToken = timeoutCts.Token;

        try
        {
            // FactoryDbContext is registered SCOPED (EF Core default), so resolve it inside a scope.
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<FactoryDbContext>();

            // One lightweight query forces token acquisition, the Direct-mode connection, and the EF model build.
            await db.Factories.Take(1).ToListAsync(linkedToken);

            stopwatch.Stop();
            logger.LogInformation("Cosmos warmup completed in {ElapsedMs} ms", stopwatch.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            logger.LogWarning(ex,
                "Cosmos warmup failed/timed out after {ElapsedMs} ms; first request will pay init cost",
                stopwatch.ElapsedMilliseconds);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
