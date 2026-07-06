# CLAUDE.md

## What this is

A [Satisfactory](https://www.satisfactorygame.com/) factory production-chain planner. The React SPA does **all** solving in-browser via a GLPK.js linear-programming solver; the .NET API is intentionally thin — it only persists and serves shared factories in Cosmos DB. Game data ships as static JSON bundled with the client. Every factory is encoded into a shareable URL.

## Architecture

- The whole app is orchestrated for local dev by .NET Aspire in `YetAnotherFactoryPlanner.AppHost`.
- The front end is in `client/`
- The API is Azure Static Web Apps managed functions (.NET 8 isolated) in `api.functions/`, with the portable share-factory logic in `api.Core/`; served same-origin at `/api/*`
- A complimentary CLI tool that parses the Satisfactory game data file in `ParseDocs/`

### Game data flow

Game data ships as **static JSON bundled with the client** (no API call). `ParseDocs` converts Satisfactory's `Docs.json` into per-entity JSON (`buildings`/`recipes`/`resources`/`items`/`handGatheredItems`) under `client/src/data/<version>/` (e.g. `1.1`/`1.2`); the client's `gameData` context loads it via `loadGameData(version)` — a version-keyed dynamic `import()` that code-splits one hashed chunk per game version.

## Commands

### Run the entire stack

```bash
aspire run    # starts Cosmos emulator + API (:8000) + Vite client (:5173); opens Aspire Dashboard
```

The Vite client is excluded from the deploy process as Aspire doesn't have a native Statis Web App module.

## Notes

- C#: nullable enabled, implicit usings. AppHost + tests target .NET 10; the SWA managed functions (`api.functions`/`api.Core`) target **.NET 8** (`dotnet-isolated:8.0` — SWA rejects .NET 9 managed-functions deploys).
- Cosmos: local dev uses the Aspire-managed Linux emulator (preview)
- The Aspire MCP server is configured — use it (list resources / console logs / structured logs / traces) to inspect and debug the running app instead of guessing. See `ASPIRE_MCP_GUIDE.md`.

## Constraints

This is a fork of lunafoxfire/yet-another-factory-planner. Our repo is **Greven145/yet-another-factory-planner**.

- `origin` → `Greven145/yet-another-factory-planner` (our fork — the correct repo)
- `upstream` → `lunafoxfire/yet-another-factory-planner` (original — ignore; we will NOT merge back)

Always pass `--repo Greven145/yet-another-factory-planner` (or `-R Greven145/yet-another-factory-planner`) to `gh` commands. Never interact with the lunafoxfire repo.