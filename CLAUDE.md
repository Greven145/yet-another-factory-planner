# CLAUDE.md

## What this is

A [Satisfactory](https://www.satisfactorygame.com/) factory production-chain planner. The React SPA does **all** solving in-browser via a GLPK.js linear-programming solver; the .NET API is intentionally thin — it serves embedded game data and persists shared factories to Cosmos DB. Every factory is encoded into a shareable URL.

## Architecture

- The whole app is orchestrated for local dev by .NET Aspire in `YetAnotherFactoryPlanner.AppHost`.
- The front end is in `client/`
- The web service is in `api.web`
- A complimentary CLI tool that parses the Satisfactory game data file in `ParseDocs/`

### Game data flow

Satisfactory `Docs.json` → `ParseDocs` → `.resx` in `api.web/Resources/` → served by `/initialize` (selected by `gameVersion`, e.g. `1.1`/`1.2`, see `api.web/Models/GameData.cs`) → consumed by the client's `gameData` context.

## Commands

### Run the entire stack

```bash
aspire run    # starts Cosmos emulator + API (:8000) + Vite client (:5173); opens Aspire Dashboard
```

The Vite client is excluded from the deploy process as Aspire doesn't have a native Statis Web App module.

## Notes

- C#: nullable enabled, implicit usings, .NET 10.
- Cosmos: local dev uses the Aspire-managed Linux emulator (preview)
- The Aspire MCP server is configured — use it (list resources / console logs / structured logs / traces) to inspect and debug the running app instead of guessing. See `ASPIRE_MCP_GUIDE.md`.

## Constraints

This is a fork of lunafoxfire/yet-another-factory-planner. Our repo is **Greven145/yet-another-factory-planner**.

- `origin` → `Greven145/yet-another-factory-planner` (our fork — the correct repo)
- `upstream` → `lunafoxfire/yet-another-factory-planner` (original — ignore; we will NOT merge back)

Always pass `--repo Greven145/yet-another-factory-planner` (or `-R Greven145/yet-another-factory-planner`) to `gh` commands. Never interact with the lunafoxfire repo.