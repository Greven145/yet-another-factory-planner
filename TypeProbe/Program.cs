// Probe Azure.Provisioning type members via reflection — writes output to a file
using System.Reflection;

var outputPath = Path.Combine(AppContext.BaseDirectory, "probe-output.txt");
var sb = new System.Text.StringBuilder();

var cosmosPath = @"C:\Users\mark\.nuget\packages\azure.provisioning.cosmosdb\1.0.0\lib\netstandard2.0\Azure.Provisioning.CosmosDB.dll";
var acaPath = @"C:\Users\mark\.nuget\packages\azure.provisioning.appcontainers\1.1.0\lib\netstandard2.0\Azure.Provisioning.AppContainers.dll";

// CosmosDB probe
sb.AppendLine("=== CosmosDBSqlContainer ALL properties ===");
try
{
    var asm = Assembly.LoadFrom(cosmosPath);
    var t = asm.GetType("Azure.Provisioning.CosmosDB.CosmosDBSqlContainer");
    if (t is not null)
    {
        foreach (var p in t.GetProperties(BindingFlags.Public | BindingFlags.Instance).OrderBy(p => p.Name))
            sb.AppendLine($"  {p.PropertyType.Name} {p.Name}");
    }
    sb.AppendLine("--- All CosmosDB properties containing Ttl or TimeToLive ---");
    foreach (var type in asm.GetExportedTypes())
        foreach (var p in type.GetProperties(BindingFlags.Public | BindingFlags.Instance))
            if (p.Name.Contains("Ttl", StringComparison.OrdinalIgnoreCase) || p.Name.Contains("TimeToLive", StringComparison.OrdinalIgnoreCase))
                sb.AppendLine($"  {type.Name}.{p.Name} : {p.PropertyType.Name}");
}
catch (Exception ex) { sb.AppendLine($"CosmosDB ERROR: {ex.Message}"); }

// ACA probe
sb.AppendLine();
sb.AppendLine("=== ContainerApp Template.Scale members ===");
try
{
    var asm = Assembly.LoadFrom(acaPath);
    var caType = asm.GetType("Azure.Provisioning.AppContainers.ContainerApp");
    if (caType is not null)
    {
        var templateProp = caType.GetProperty("Template");
        sb.AppendLine($"Template: {templateProp?.PropertyType?.FullName ?? "NOT FOUND"}");
        if (templateProp is not null)
        {
            var scaleProp = templateProp.PropertyType.GetProperty("Scale");
            sb.AppendLine($"Scale: {scaleProp?.PropertyType?.FullName ?? "NOT FOUND"}");
            if (scaleProp is not null)
                foreach (var pp in scaleProp.PropertyType.GetProperties(BindingFlags.Public | BindingFlags.Instance).OrderBy(p => p.Name))
                    sb.AppendLine($"  Scale.{pp.Name} : {pp.PropertyType.Name}");
        }
    }
    else sb.AppendLine("ContainerApp type not found");
}
catch (Exception ex) { sb.AppendLine($"ACA ERROR: {ex.Message}"); }

// Aspire.Hosting.Azure.AppContainers — find PublishAsAzureContainerApp method
sb.AppendLine();
sb.AppendLine("=== Aspire.Hosting.Azure.AppContainers extension methods ===");
try
{
    var aspirePath = @"C:\Users\mark\.nuget\packages\aspire.hosting.azure.appcontainers\13.2.4\lib\net8.0\Aspire.Hosting.Azure.AppContainers.dll";
    var asm = Assembly.LoadFrom(aspirePath);
    foreach (var type in asm.GetExportedTypes())
        foreach (var m in type.GetMethods(BindingFlags.Public | BindingFlags.Static))
            if (m.Name.Contains("ContainerApp", StringComparison.OrdinalIgnoreCase) || m.Name.Contains("Configure", StringComparison.OrdinalIgnoreCase))
                sb.AppendLine($"  {type.Name}.{m.Name}({string.Join(", ", m.GetParameters().Select(p => p.ParameterType.Name + " " + p.Name))})");
}
catch (Exception ex) { sb.AppendLine($"Aspire ACA ERROR: {ex.Message}"); }

File.WriteAllText(outputPath, sb.ToString());
Console.WriteLine($"Written to: {outputPath}");
