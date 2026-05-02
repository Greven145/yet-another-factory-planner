#!/usr/bin/env pwsh
# Starts the YAFP legacy Docker Compose stack (idempotent - safe to run multiple times).
# Ports: client → http://localhost:3000  |  API proxy → http://localhost:3001  |  CosmosDB → localhost:8082

[CmdletBinding()]
param(
    [switch]$Rebuild,   # Force rebuild of images even if nothing changed
    [switch]$Detach,    # Detach immediately (skip health-check waiting)
    [switch]$Down       # Stop and remove containers instead of starting
)

$ErrorActionPreference = "Stop"
$compose = @("docker-compose",
    "--project-directory", $PSScriptRoot,
    "--project-name", "yafp-legacy",
    "-f", (Join-Path $PSScriptRoot "docker-compose.yml"))

if ($Down) {
    Write-Host "Stopping yafp-legacy stack..." -ForegroundColor Yellow
    & $compose[0] $compose[1..($compose.Length-1)] down
    Write-Host "Done." -ForegroundColor Green
    exit 0
}

$upArgs = @("up", "--detach", "--remove-orphans")
if ($Rebuild) { $upArgs += "--build" }

Write-Host "Starting yafp-legacy stack..." -ForegroundColor Cyan
& $compose[0] $compose[1..($compose.Length-1)] @upArgs

if ($LASTEXITCODE -ne 0) {
    Write-Error "docker-compose failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

if (-not $Detach) {
    Write-Host "`nWaiting for CosmosDB emulator to become healthy..." -ForegroundColor Cyan
    $deadline = (Get-Date).AddMinutes(3)
    $healthy = $false
    while ((Get-Date) -lt $deadline) {
        $status = docker inspect --format "{{.State.Health.Status}}" yafp-legacy-cosmosdb-1 2>$null
        if ($status -eq "healthy") { $healthy = $true; break }
        Write-Host "  CosmosDB status: $status — waiting..." -ForegroundColor DarkGray
        Start-Sleep -Seconds 5
    }
    if (-not $healthy) {
        Write-Warning "CosmosDB did not become healthy within 3 minutes. Check: docker logs yafp-legacy-cosmosdb-1"
    }
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host " Legacy YAFP stack is running" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "  Client    → http://localhost:3000" -ForegroundColor White
Write-Host "  API proxy → http://localhost:3001" -ForegroundColor White
Write-Host "  CosmosDB  → localhost:8082" -ForegroundColor White
Write-Host ""
Write-Host "To rebuild images:  .\start.ps1 -Rebuild" -ForegroundColor DarkGray
Write-Host "To stop & remove:   .\start.ps1 -Down" -ForegroundColor DarkGray
Write-Host "Logs:               docker-compose --project-name yafp-legacy logs -f" -ForegroundColor DarkGray
