# RAGPilot API

This FastAPI service is RAGPilot's tenant-aware business gateway and policy enforcement boundary.

## API Scope

The API owns:

- authentication, sessions, invitations, access policy, tenant membership, and scoped platform API keys
- tenants, workspaces, knowledge bases, durable Data Sources and sync leases, documents, access-group/document/Chunk ACL policy, ingestion, and search projection diagnostics
- hybrid retrieval, retrieval profiles, evaluation records, provider-native/fallback SSE Chat, citations, feedback, and Prompt bindings
- workflow inspection, recovery, cancellation, and operator events
- Agent definitions, durable runs and executions, approvals, retry/cancel/replay lineage, immutable execution-policy snapshots, JSON Schema output contracts, and evaluation summaries
- model endpoints, runtime credentials, Tool registrations, MCP connectors, health history, and governance worklists
- trace propagation, audit evidence, structured logging, and bounded runtime telemetry

The exact current route inventory is generated and audited against FastAPI in [`docs/api/api-outline.md`](../../docs/api/api-outline.md). Do not maintain a second hand-written endpoint list here.

## Security Boundary

Routes resolve an authenticated actor from a bearer session or tenant-scoped platform API key. Authorization remains backend-owned and covers role capabilities, API-key scopes, active tenant membership, workspace access, knowledge-base access, and resource ownership where applicable. Legacy actor headers are development-only and disabled unless explicitly configured.

API-key secrets are displayed once, stored as hashes, and support scope, expiry, revocation, usage tracking, and audit events. Runtime provider and MCP credentials use the encrypted credential boundary rather than plaintext model records.

## Database Migrations

Alembic migrations live in `migrations/`. From the repository root, the supported local command is:

```powershell
npm run api:migrate
```

When invoking Alembic directly from `apps/api` against the Docker Compose database, set `POSTGRES_HOST=localhost` and `POSTGRES_PORT=5432` first.

## Verification

From the repository root:

```powershell
npm run api:test
```

The repository release preflight also runs the versioned retrieval regression gate and validates the migration head, public documentation, delivery assets, and other release contracts.

## Naming and Layering

- package root: `ragpilot_api`
- route modules: `*_routes.py`
- DTO contracts: `*_contracts.py`
- application services: `*_service.py`
- runtime settings: `shared/settings.py`

Keep business policy in application/domain services and repositories rather than HTTP route handlers.
