# Copilot Instructions

## Architecture

This is a **Satisfactory factory planner** web app. The client is a React SPA that performs all production-chain calculations in-browser using a GLPK.js linear programming solver. The .NET API is minimal — it only serves game data and persists shared factories to CosmosDB.

- **`client/`** — React 17 + TypeScript (strict mode), built with Craco (CRA override). Styling via styled-components + Mantine v4.
- **`api/`** — .NET 7 Azure Functions v4 (isolated worker model). Three endpoints: `GET /ping`, `GET /initialize`, `POST /share-factory`.
- **`ParseDocs/`** — .NET CLI tool that parses Satisfactory docs JSON into game data resource files embedded in the API.

## Build & Run

### Full stack (Docker)

```sh
docker-compose up
```

Starts the client (Nginx on :80), API behind an Nginx proxy (:8080), and a CosmosDB emulator.

### Client only

```sh
cd client
npm install
npm start        # Dev server via Craco
npm run build    # Production build
```

### API only

```sh
cd api
dotnet restore
dotnet build
dotnet run       # Requires local.settings.json (see local.settings.json_sample)
```

### ParseDocs

Parses Satisfactory 1.1 game data from the Node.js `satisfactory-docs-parser` output into format used by the API.

**Input**: Expects pre-parsed JSON files from `satisfactory-docs-parser` (buildables.json, productionRecipes.json, resources.json, items.json, buildableRecipes.json)

**Output**: Generates API-ready resource files (buildings.json, recipes.json, resources.json, items.json, handGatheredItems.json)

```sh
# With .NET 7 SDK (if installed):
cd ParseDocs
dotnet run -- --input <path-to-parsed-docs> --output <path-for-output>

# With Docker (recommended):
cd ParseDocs
docker build -t parsedocs:latest .
docker run --rm \
  -v "${PWD}:/data" \
  -v "${PWD}/output:/output" \
  parsedocs:latest \
  --input /data --output /output
```

**Standard workflow**:
1. Copy parsed files from `satisfactory-docs-parser/data/parsed/` to `ParseDocs/`
2. Run ParseDocs to generate output in `ParseDocs/output/`
3. Copy output files to `api/Resources/` as embedded resources for the API

## Testing

### Client (Jest + React Testing Library)

```sh
cd client
npm test                              # Watch mode
npm test -- --watchAll=false          # Single run
npm test -- --testPathPattern=reducer # Run specific test file
```

### API (xUnit + FluentValidation.TestHelper)

Requires .NET 7 SDK. Use Docker if not installed locally:

```sh
# With local .NET 7 SDK:
dotnet test api.Tests/

# With Docker:
docker run --rm -v "${PWD}:/src" -w /src mcr.microsoft.com/dotnet/sdk:7.0 dotnet test api.Tests/
```

## Key Conventions

### Client

- **State management**: React Context + useReducer — not Redux. Contexts are in `client/src/contexts/` (ProductionContext, GameDataContext, GlobalContext, DrawerContext). Each exposes a custom hook.
- **Component organization**: `components/` for reusable presentational components, `containers/` for feature logic with state and API calls.
- **API layer**: Axios-based modules in `client/src/api/modules/`. Each module exports a custom hook (e.g., `useGetInitialize`). The shared `useApi` hook manages loading/error/data states.
- **Styling**: All CSS is styled-components (no CSS files). Theme defined in `client/src/theme.ts`.
- **Production solver**: `client/src/utilities/production-solver/` — converts factory config into a GLPK linear programming model and solves in-browser.

### API (.NET)

- **File-scoped namespaces** and **tabs for indentation** (see `.editorconfig`).
- **FluentValidation** for request validation with nested validators in `api/Validation/`.
- **OneOf** discriminated unions for method return types (e.g., `OneOf<FactoryConfig, None>`).
- **Response helpers**: Extension methods in `Extensions/CreateResponseExtensions.cs` wrap all responses in a `{ data: ... }` envelope with camelCase JSON.
- **Game data**: Stored as `.resx` resource files, supporting versions U5–U8.
- **CosmosDB**: `FactoryClient` abstracts all database access. Database `shared-factory`, container `factories`, partitioned by `/gameVersion`.
