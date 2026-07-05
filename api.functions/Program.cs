using System.Text.Json;
using api.functions.Services;
using api.Validation;
using FluentValidation;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = FunctionsApplication.CreateBuilder(args);

builder.ConfigureFunctionsWebApplication();

// One camelCase System.Text.Json options instance, shared by both the Cosmos serializer and the
// HTTP response writer. camelCase maps FactoryConfigSchema.Id -> "id" (Cosmos's required document
// id property) and GameVersion -> "gameVersion" (the /gameVersion partition key), byte-matching the
// rows the retired EF Core path wrote so existing share links keep resolving.
var jsonOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web);
builder.Services.AddSingleton(jsonOptions);

// Raw Cosmos SDK (no EF Core, no CosmosWarmupService). The Aspire client integration reads the
// connection string named "cosmosdb" (config key ConnectionStrings:cosmosdb, env
// ConnectionStrings__cosmosdb) — injected locally by the AppHost's .WithReference(cosmosDb) and,
// in production, supplied by the SWA app settings (key-based; see Step 3 infra). The name is
// hyphen-free because SWA app-setting keys reject '-'. It also transparently trusts the local
// preview emulator's self-signed certificate.
builder.AddAzureCosmosClient(
    "cosmosdb",
    configureClientOptions: options =>
    {
        options.UseSystemTextJsonSerializerWithOptions = jsonOptions;
    });

builder.Services.AddValidatorsFromAssemblyContaining<FactoryConfigSchemaValidator>();
builder.Services.AddSingleton<FactoryClient>();

builder.Build().Run();
