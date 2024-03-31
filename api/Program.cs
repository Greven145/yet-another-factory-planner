using api;
using api.Extensions;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var host = new HostBuilder()
    .ConfigureFunctionsWebApplication()
    .ConfigureServices(services => {
        services.AddApplicationInsightsTelemetryWorkerService()
        .ConfigureFunctionsApplicationInsights()
        .AddFluentValidation()
        .AddScoped<FactoryClient>();
    })
    .Build();

host.Run();