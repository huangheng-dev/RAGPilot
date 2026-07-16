# Local Development Runbook

## Prerequisites

- Windows PowerShell or PowerShell 7
- Node.js 20 or newer and npm
- Python 3.10 or newer (the repository-local default is 3.11)
- Docker Desktop or a compatible Docker Compose runtime
- optional Ollama, vLLM, or OpenAI-compatible endpoints for non-deterministic model testing

Do not reuse example credentials in a shared or production environment.

## Initial Setup

From the repository root:

```powershell
Copy-Item .env.example .env
npm install
```

Review `.env` before startup. Host-managed stable mode translates Docker-oriented dependency endpoints to their host ports where required. Production defaults and secret expectations belong in `.env.production.example`.

## Recommended Stable Mode

Start the normal local stack:

```powershell
npm run stable:mode:up
```

Stable mode runs Web and API as host-managed processes and keeps stateful dependencies plus Workers in Docker.

Inspect status:

```powershell
npm run stable:mode:status
```

Stop host processes and dependency services:

```powershell
npm run stable:mode:down
```

Stable runtime PIDs, launchers, dependency fingerprints, stdout, and stderr are stored under `tmp/stable-mode/`.

## Local Endpoints

- Web: `http://127.0.0.1:3000`
- API: `http://127.0.0.1:8000`
- API health: `http://127.0.0.1:8000/api/v1/health`
- Temporal UI: `http://127.0.0.1:8080`
- Temporal gRPC: `127.0.0.1:7233`
- PostgreSQL: `127.0.0.1:5432`
- Redis: `127.0.0.1:6379`
- Elasticsearch: `http://127.0.0.1:9200`
- MinIO API: `http://127.0.0.1:9000`
- MinIO Console: `http://127.0.0.1:9001`
- OTLP gRPC: `127.0.0.1:4317`
- OTLP HTTP: `http://127.0.0.1:4318`
- OpenTelemetry metrics scrape: `http://127.0.0.1:9464/metrics`
- Tempo: `http://127.0.0.1:3200`
- Prometheus: `http://127.0.0.1:9090`
- Grafana: `http://127.0.0.1:3001`

The repository uses each component's conventional host port except Grafana, which uses `3001` because the Web product owns `3000`. When a host port is already occupied, override the corresponding `RAGPILOT_*_PORT` in `.env`; supported Compose commands load that file and do not change container-internal service ports.

## Authentication

Authentication behavior is controlled by `AUTH_PRIMARY_MODE`.

- local modes use the backend bootstrap/login/session contracts
- only the first User can use bootstrap
- later Users must be created or invited through governed administration
- password-local deployments require real passwords and backend-issued sessions
- external modes require their provider callback and claim mapping to be configured
- `ALLOW_LEGACY_ACTOR_HEADERS` should remain `false` except for a deliberate compatibility exercise

RAGPilot does not ship a universal account or production password. Use the `/login` flow to provision the first local administrator only when the selected mode permits bootstrap.

## Database Migrations

Run the current migration chain against the local Docker PostgreSQL service:

```powershell
npm run api:migrate
```

Equivalent manual command:

```powershell
$env:POSTGRES_HOST='localhost'
$env:POSTGRES_PORT='5432'
Set-Location apps/api
.\.venv\Scripts\alembic.exe upgrade head
```

Every ORM change requires an Alembic migration and a clean-database upgrade check. Do not rely on an existing development database to prove schema completeness.

## Validation Commands

Run the API suite and versioned retrieval regression gate:

```powershell
npm run api:test
```

Run Worker tests:

```powershell
npm run worker:test
```

Build the production Web bundle:

```powershell
npm run web:check
```

Build and test the standalone MCP server:

```powershell
npm run mcp:build
npm run mcp:test
```

To run the read-only `stdio` server, create a tenant-scoped platform API key with the minimum required capabilities and set `MCP_RAGPILOT_API_KEY`. The default `MCP_RAGPILOT_API_BASE_URL` targets local stable mode. Then let an MCP host spawn `npm run mcp:dev`; protocol messages use standard input/output, so do not add ordinary logging to standard output.

Run the isolated authenticated browser flow. This command creates and migrates a disposable database, builds Web, starts isolated API/Web processes, runs Playwright, and removes the test database:

```powershell
npm run e2e:test
```

Run the complete release gate before tagging or publishing:

```powershell
npm run release:preflight
```

## Isolated Development

Start only Docker dependencies when running API/Web commands manually:

```powershell
npm run compose:deps:up
```

Stop those dependency services:

```powershell
npm run compose:deps:down
```

For a full container build:

```powershell
npm run compose:up:detached
```

For frontend-only iteration against an already-running API:

```powershell
npm run web:serve
```

The API and Worker virtual environments live under their application directories. Prefer repository scripts because they install the required optional LlamaIndex/LangGraph runtime extras and keep host-specific settings consistent.

## Runtime and Dependency Checks

After startup:

1. confirm `npm run stable:mode:status` reports host API/Web processes and required Docker services;
2. confirm `/api/v1/health` returns `status: ok`;
3. confirm effective Chat model, retrieval engine, Agent runtime, and projection posture match the intended `.env` configuration;
4. inspect `tmp/stable-mode/*.stderr.log` before treating a reachable port as a healthy service;
5. verify migrations reached the current Alembic head.

For model or MCP changes, use the governed preview/compatibility endpoints and review the persisted health history instead of testing secrets through ad-hoc scripts.

## Observability

Local Compose enables OpenTelemetry by default. API requests return a correlated `traceparent`, and trace context propagates across Temporal, Worker, retrieval, model, Tool, MCP, embedding, and Elasticsearch boundaries.

- keep prompts, credentials, document content, authorization headers, and unbounded tenant/user values out of telemetry
- use bounded identifiers and counts only where the observability contract permits them
- treat missing child spans, exporter failures, sustained projection lag, failed Outbox events, or rising runtime error counters as investigation signals
- disable OTLP export in isolated unit tests so deployment `.env` values cannot start background exporter retries

Production sampling, retention, alert routing, and incident ownership are deployment decisions; local 100% sampling is not a production recommendation.

## Configuration Changes

Restart the affected service after changing:

- Python or Node dependencies
- migrations or ORM models
- environment variables
- model, retrieval, Agent, MCP, Redis-limit, or telemetry wiring
- Web build-time public environment variables

Stable mode fingerprints API dependency files and rebuilds/restarts managed processes when necessary. Small UI or test edits do not require restarting every dependency.

## Troubleshooting

### Stable mode does not start

- run `npm run stable:mode:status`
- inspect `tmp/stable-mode/` stderr logs
- confirm ports are not owned by unrelated processes
- confirm Docker Desktop is running
- verify PostgreSQL and Temporal complete readiness checks, not only TCP connection

### API starts but requests fail

- run `npm run api:migrate`
- inspect the API stderr log
- verify host dependency ports and credentials
- check `/api/v1/health` for runtime and search-projection diagnostics

### Retrieval is degraded

- confirm Elasticsearch reachability and active Read/Write Alias posture
- inspect Outbox pending, processing, failed, lag, and stale-document diagnostics
- confirm PostgreSQL lexical fallback is reported explicitly rather than silently mislabelled as Elasticsearch retrieval

### Model or MCP calls are blocked

- inspect endpoint/connector approval and enabled status
- review encrypted credential presence and health history
- inspect Redis limit classification and configured failure mode
- verify outbound URL policy, protocol compatibility, timeout, and cancellation posture

### Browser E2E leaves a port occupied

The E2E runner normally terminates isolated API/Web processes and drops its database in `finally`. If interrupted externally, inspect listeners on ports `18001` and `3002` before rerunning; stop only the confirmed E2E child process.
