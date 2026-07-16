# RAGPilot Repository Structure

## Purpose

This document defines where current RAGPilot code, contracts, infrastructure, evaluation assets, and documentation belong. It is a placement guide, not a speculative directory plan.

## Top-Level Layout

```text
RAGPilot/
  apps/
    web/
    api/
    worker/
    mcp-server/
  packages/
    shared-types/
    prompts/
    evals/
  infra/
    docker/
    k8s/
    observability/
    otel/
    scripts/
  docs/
    api/
    architecture/
    planning/
    product/
    runbooks/
  README.md
  README.zh-CN.md
  CONTRIBUTING.md
  SECURITY.md
  CHANGELOG.md
  package.json
```

## Top-Level Ownership

### `apps/`

Contains deployable application services. Each application has its own runtime entry point, dependencies, tests, and focused README.

### `packages/`

Contains versioned assets or contracts shared across applications. It must not become a general-purpose utility dump.

### `infra/`

Contains local infrastructure, production-oriented deployment baselines, observability configuration, and validation/operations scripts.

### `docs/`

Contains public technical documentation versioned with code. Sensitive organization-specific material belongs only in ignored `docs/internal/` or `docs/private/` directories.

## Applications

### `apps/web`

The Next.js App Router application owns human-facing product surfaces.

Current routes include:

- `/` — Home
- `/chat`
- `/documents`
- `/agents`
- `/access-control`
- `/admin`
- `/operations`
- `/settings`
- `/login`
- `/workspace` — compatibility route

Placement rules:

- route entry points belong in `app/<route>/page.tsx`;
- reusable product components belong in `components/<domain>/`;
- API clients, authenticated request helpers, route builders, and session helpers belong in `lib/`;
- localized copy belongs in `messages/`;
- browser acceptance tests belong in `tests/e2e/`;
- backend authorization rules must not be recreated as client-only policy.

### `apps/api`

The FastAPI application owns the business gateway and policy enforcement boundary.

```text
apps/api/
  migrations/
  ragpilot_api/
    application/
    commands/
    contracts/
    infrastructure/
    presentation/
    shared/
    workers/
    workflows/
  tests/
```

Responsibilities by directory:

- `application/` — domain use cases and business policy
- `commands/` — explicit CLI validation and maintenance entry points
- `contracts/` — HTTP and integration DTOs
- `infrastructure/` — database, repositories, search, model, MCP, telemetry, security, and Temporal adapters
- `presentation/` — FastAPI routing and actor resolution
- `shared/` — narrowly shared settings and cross-domain primitives
- `workers/` and `workflows/` — Agent execution Worker and Temporal workflow definitions owned by the API runtime
- `migrations/` — Alembic schema history
- `tests/` — unit, contract, route, integration-boundary, and documentation-consistency tests

HTTP route files translate contracts; they should not own business policy or persistence logic.

### `apps/worker`

The Python Temporal Worker owns document and Data Source background processing.

```text
apps/worker/ragpilot_worker/
  activities/
  application/
  commands/
  domain/
  infrastructure/
  workflows/
  config.py
  main.py
```

- `activities/` — Temporal activity entry points
- `application/` — synchronization and ingestion orchestration services
- `domain/` — parser, chunking, and connector contracts
- `infrastructure/` — object storage, embedding, search, telemetry, and connector adapters
- `workflows/` — durable document and Data Source workflows
- `tests/` — Worker policy, parser, connector, and configuration tests

### `apps/mcp-server`

The TypeScript MCP server exposes a small read-only Tool surface over `stdio`.

- `src/api-client.ts` owns scoped calls to the main API;
- `src/server.ts` owns MCP Tool definitions and protocol handling;
- `src/index.ts` owns process startup;
- `tests/` owns API-client and server protocol tests.

It delegates authorization to the API through a scoped platform API key and must not add direct database or storage access.

## Shared Packages

### `packages/shared-types`

Location for generated OpenAPI schemas, cross-service TypeScript DTOs, and event contracts. Generate or version contracts here instead of copying them between applications.

### `packages/prompts`

Location for authored Prompt assets and import/export tooling. Active Prompt Templates and Versions are persisted in PostgreSQL; runtime records bind version identity and hashes rather than modifying package files.

### `packages/evals`

Location for version-controlled evaluation datasets and benchmark contracts. Retrieval fixtures live under `packages/evals/retrieval/` and are executed by deterministic and real-database gates.

## Infrastructure

### `infra/docker`

Owns Dockerfiles and the health-gated Compose topology for PostgreSQL, Redis, MinIO, Elasticsearch, Temporal, API, Workers, Web, and the observability stack.

### `infra/k8s`

Owns the Kubernetes delivery baseline: namespace, ConfigMap, Secret template/integration, database migration Job, Deployments, Services, ingress, probes, resources, autoscaling/disruption controls, and Kustomize assembly.

Environment-specific overlays and real Secret material must remain outside the public baseline.

### `infra/observability`

Owns Prometheus, Tempo, Grafana provisioning, dashboards, and alert baselines.

### `infra/otel`

Owns OpenTelemetry Collector configuration.

### `infra/scripts`

Owns repeatable local startup, migration, test, release, documentation, security, backup/restore, reliability, and publishing helpers. Scripts should be non-interactive where CI or release automation consumes them.

## Documentation

### `docs/product`

- `project-blueprint.md` — durable target and product boundaries
- `project-snapshot.md` — verified current product behavior

### `docs/architecture`

- `system-overview.md` — realized runtime architecture
- `platform-data-model.md` — implemented SQLAlchemy/Alembic table contract
- `repository-structure.md` — placement rules
- `naming-conventions.md` — naming standards

### `docs/api`

- `api-outline.md` — implemented FastAPI route inventory and contract summary

### `docs/planning`

- `roadmap.md` — the single source for active evolution priorities

### `docs/runbooks`

- `local-development.md` — setup, validation, and troubleshooting
- `production-reliability.md` — deployment decisions, SLOs, recovery, and operational exercises

## Placement Rules

1. Place code under the deployable application that owns its runtime behavior.
2. Place shared assets in `packages/` only when multiple applications consume a stable contract.
3. Keep domain policy out of route handlers, React presentation components, and generic helper modules.
4. Keep PostgreSQL as the durable business-state owner; search and cache integrations remain replaceable infrastructure.
5. Add schema changes through Alembic and update the data-model contract in the same change.
6. Add or change HTTP routes together with API-outline and automated documentation-contract validation.
7. Record verified behavior in the Snapshot and prioritized evolution in the Roadmap; do not create competing status documents.
8. Keep generated output, local credentials, private deployment overlays, and organization-specific notes out of tracked source directories.

## Decision Rule

If a file has no clear runtime, domain, contract, infrastructure, or documentation owner, define that ownership before adding the file. Do not solve ambiguity with `common`, `utils`, `misc`, or another catch-all directory.
