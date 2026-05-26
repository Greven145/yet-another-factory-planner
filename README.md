# Community

The original author is dealing with life issues, and in an attempt to have a version of the tool that I like and to have it available, I have forked this repo and modified the backend to work on an Azure Function consumption plan with a consumption based Cosmos DB data store, serving the UI file from a CDN resource.

# To Come

* Infrastructure automation code for provisioning the appropriate resources to host the tool
* Github workflows to build, test, scan, etc etc the code

# Info

This is a tool for designing production chains in [Satisfactory](https://www.satisfactorygame.com/). You can choose what and how many items you want to produce, and what items and recipes are available to you, and the calculator will calculate the entire production chain for those items. This particular tool was built with designing mega-bases with ridiculous production needs in mind, so the solver is fast regardless of the complexity of the production goals.

Powered by my [satisfactory-docs-parser](https://github.com/lydianlights/satisfactory-docs-parser).

# Site

https://www.satisfactory-planner.net

# Features

-   Choose production goals, available resources, and allowed recipes, and the solver will find the best production chain.
-   Every factory is stored as a sharable link for easy saving and collaboration.
-   All calculations are done in-browser... meaning no server communication to slow down site responsiveness. It's FAST!
-   When choosing production goals you can choose either a target item/min rate, a target number of copies of a recipe, or you can maximize the production given the available resources.
-   You can also choose AWESOME Sink Points as a production goal :D
-   Recipes involving Nuclear Power Plants can be used, unlike other current production planners.
-   All weights that the solver uses when determining the best production chain are made transparent and customizable by the user. Want to reduce how much you value Crude Oil and increase how much you value Copper Ore? Well now you can!
-   Hand-gathered materials can optionally be included as inputs.
-   Detailed Reporting section that calculates some interesting statistics including points produced, estimated power usage (or production), and minimum build area.
-   Detailed breakdown of materials needed to construct the factory (which is SUPER helpful for huge factories). This includes a rough estimate on the minimal number of foundations required, and a list of all buildings required and their total build costs.

# Local Development with .NET Aspire

This project uses .NET Aspire 13 for local development orchestration, providing a unified development experience with built-in observability and service discovery.

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- [Node.js](https://nodejs.org/) (for React client)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for Cosmos DB emulator)

## Running the Application (Current Version)

Use the [.NET Aspire CLI](https://learn.microsoft.com/dotnet/aspire/fundamentals/cli):

```bash
aspire run
```

This starts the Cosmos DB emulator, the ASP.NET Core Web API (port 8000), and the Vite dev server, and opens the **Aspire Dashboard** for real-time logs, traces, and service health.

## Accessing Services (Current Version)

| Service | URL |
|---|---|
| React Client | http://localhost:5173 |
| API | http://localhost:8000 |
| Aspire Dashboard | displayed on startup |

## Production Deployment Model (Current)

This repo is wired for a split production deployment:

- Frontend: Azure Static Web Apps (managed outside Aspire deployment)
- Backend API: Azure Container Apps (deployed via Aspire)
- Data: Azure Cosmos DB (provisioned via Aspire)

### Deploy backend with Aspire (Azure Container Apps)

From repository root:

```bash
aspire deploy
```

The CLI can be interactive. For non-interactive CI/CD, set:

- `Azure__SubscriptionId`
- `Azure__Location`
- `Azure__ResourceGroup`

Notes:

- The AppHost includes the Vite client only in `Development` and `Testing` environments for local workflows.
- Production deploys from this AppHost target the API/Cosmos backend stack; keep Static Web Apps as the public frontend.

---

# Legacy Environment (for Comparison)

The `legacy/docker-baseline` branch preserves the last known working state of the app before the modernization effort (React 17 + CRA + Azure Functions v4 + .NET 7). It runs alongside the current version on different ports using Docker Compose.

## Setup

The legacy version is designed to run from a [git worktree](https://git-scm.com/docs/git-worktree) so both versions can be checked out simultaneously:

```bash
# From the main repo root — only needed once
git worktree add ../yafp-legacy legacy/docker-baseline
```

## Starting the Legacy Stack

```powershell
cd ..\yafp-legacy
.\start.ps1           # Build (first run) and start in background
.\start.ps1 -Rebuild  # Force image rebuild (after code changes)
.\start.ps1 -Down     # Stop and remove containers
```

The script is **idempotent** — running it when the stack is already up has no effect.

## Accessing Legacy Services

| Service | URL |
|---|---|
| React Client (legacy) | http://localhost:3000 |
| API proxy (legacy) | http://localhost:3001 |
| CosmosDB emulator | localhost:8082 |

## Port Summary (no conflicts)

| | Current (Aspire) | Legacy (Docker Compose) |
|---|---|---|
| Client | http://localhost:5173 | http://localhost:3000 |
| API | http://localhost:8000 | http://localhost:3001 |
| CosmosDB | Aspire-managed | localhost:8082 |

# Contributing

This repo is currently in the middle of transferring hosting providers and making some related architectural changes. AKA, Heroku was becoming too expensive when superior options are available. Contributions should be put on pause until further notice as I plan to transition the app to a fully serverless architecture. In the end it should be both cheaper, easier to maintain, and maybe even faster for worldwide users.
