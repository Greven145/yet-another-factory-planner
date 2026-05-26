# Aspire MCP Tools Quick Reference

This guide shows how to use the Aspire MCP server tools to monitor and debug your application when running with Aspire.

## Prerequisites

1. Start the application with Aspire:
   ```bash
   dotnet run --project YetAnotherFactoryPlanner.AppHost
   ```

2. The Aspire MCP server connection is automatically active when the AppHost is running.

## Common Commands

### 1. Check Service Status

**List all resources (services, containers, apps):**
```
aspire-list_resources
```

**Example output:**
- `cosmosdb` - Container (Cosmos DB emulator)
- `api` - Project (Azure Functions)
- `client` - Npm App (React dev server)

Each resource shows:
- Type (Container, Project, Executable, etc.)
- State (Running, Starting, Failed, etc.)
- Endpoints (URLs to access)
- Health status

### 2. View Service Logs

**Get console logs for a specific service:**
```
aspire-list_console_logs
  resourceName: "api"
```

**Get all logs for debugging:**
```
aspire-list_console_logs
  resourceName: "api"
```

**View Cosmos DB emulator logs:**
```
aspire-list_console_logs
  resourceName: "cosmosdb"
```

### 3. View Structured Logs

**Get structured logs for analysis:**
```
aspire-list_structured_logs
```

**Get logs for a specific service:**
```
aspire-list_structured_logs
  resourceName: "api"
```

Structured logs include:
- Timestamp
- Log level (Information, Warning, Error)
- Category (where the log came from)
- Message
- Trace context (for distributed tracing)

### 4. Distributed Tracing

**List all traces:**
```
aspire-list_traces
```

**List traces for a specific service:**
```
aspire-list_traces
  resourceName: "api"
```

**View detailed logs for a trace:**
```
aspire-list_trace_structured_logs
  traceId: "<trace-id-from-list>"
```

### 5. Control Services

**Restart a service:**
```
aspire-execute_resource_command
  resourceName: "api"
  commandName: "resource-restart"
```

**Stop a service:**
```
aspire-execute_resource_command
  resourceName: "client"
  commandName: "resource-stop"
```

**Start a service:**
```
aspire-execute_resource_command
  resourceName: "client"
  commandName: "resource-start"
```

## Troubleshooting Workflows

### Service Won't Start

1. **Check status:**
   ```
   aspire-list_resources
   ```
   Look for Failed or Exited status

2. **View logs:**
   ```
   aspire-list_console_logs
     resourceName: "<service-name>"
   ```
   Look for error messages in the output

3. **Restart if needed:**
   ```
   aspire-execute_resource_command
     resourceName: "<service-name>"
     commandName: "resource-restart"
   ```

### API Can't Connect to Cosmos DB

1. **Verify Cosmos is running:**
   ```
   aspire-list_resources
   ```
   Check if `cosmosdb` resource is in Running state

2. **Check Cosmos logs:**
   ```
   aspire-list_console_logs
     resourceName: "cosmosdb"
   ```
   Look for startup errors

3. **Check API logs:**
   ```
   aspire-list_console_logs
     resourceName: "api"
   ```
   Look for connection errors

4. **View structured logs for connection issues:**
   ```
   aspire-list_structured_logs
     resourceName: "api"
   ```
   Filter for error level logs

### React App Not Loading

1. **Check if running:**
   ```
   aspire-list_resources
   ```
   Verify `client` is Running

2. **View npm output:**
   ```
   aspire-list_console_logs
     resourceName: "client"
   ```
   Look for compilation errors or port conflicts

3. **Restart if needed:**
   ```
   aspire-execute_resource_command
     resourceName: "client"
     commandName: "resource-restart"
   ```

### Investigating API Errors

1. **Find traces with errors:**
   ```
   aspire-list_traces
     resourceName: "api"
   ```
   Look for traces with error status

2. **Get detailed trace logs:**
   ```
   aspire-list_trace_structured_logs
     traceId: "<trace-id>"
   ```
   This shows the entire request flow with all logs

3. **Review structured logs:**
   ```
   aspire-list_structured_logs
     resourceName: "api"
   ```
   Look for exceptions and error messages

## Resource Names

| Resource Name | Service | Description |
|--------------|---------|-------------|
| `cosmosdb` | Container | Cosmos DB Linux emulator (vnext-preview) |
| `api` | Project | Azure Functions .NET API |
| `client` | Npm App | React development server |

## Log Levels

When viewing structured logs, common log levels:
- **Trace** - Very detailed debugging information
- **Debug** - Debugging information
- **Information** - General informational messages
- **Warning** - Warning messages (potential issues)
- **Error** - Error messages (failures)
- **Critical** - Critical errors (system failures)

## Tips

1. **Use structured logs over console logs** when possible - they're easier to filter and analyze

2. **Check traces for distributed debugging** - they show how requests flow through services

3. **Resource commands are powerful** - you can restart services without stopping the entire AppHost

4. **Console logs show raw output** - useful for seeing npm compilation, Docker container output, etc.

5. **The Aspire Dashboard is also available** - Visual UI alternative at the URL shown when AppHost starts

## Examples

### Example: Debug a 500 error from the API

```
# 1. List recent traces to find the error
aspire-list_traces resourceName: "api"

# 2. Get detailed logs for that trace
aspire-list_trace_structured_logs traceId: "abc123..."

# 3. Review the logs to find the root cause
# Look for exception messages, stack traces, etc.
```

### Example: React app shows blank page

```
# 1. Check if it's running
aspire-list_resources

# 2. View compilation output
aspire-list_console_logs resourceName: "client"

# 3. Look for JavaScript errors or failed builds
```

### Example: Cosmos DB won't start

```
# 1. Check container status
aspire-list_resources

# 2. View Docker container logs
aspire-list_console_logs resourceName: "cosmosdb"

# 3. Look for port conflicts or Docker errors
```

## Additional Resources

- **.copilot-instructions.md** - Full project documentation with Aspire details
- **Aspire Dashboard** - Visual monitoring UI (opens automatically)
- **README.md** - Getting started guide with Aspire
- **TROUBLESHOOTING.md** - Common issues and solutions
