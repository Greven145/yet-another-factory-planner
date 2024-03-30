using Microsoft.Extensions.DependencyInjection;
using FluentValidation;
using FluentValidation.AspNetCore;
using api.Validation;

namespace api.Extensions;

internal static class StartupExtensions
{
internal static IServiceCollection AddFluentValidation(this IServiceCollection services) =>
    services.AddValidatorsFromAssembly(typeof(FactoryConfigSchemaValidator).Assembly);
}