# RagPilot Repository Structure

## Purpose

This document defines the intended repository structure for RagPilot. It explains where product features, service code, shared contracts, infrastructure, and documentation should live.

RagPilot is a monorepo. The repository should keep application boundaries clear while allowing shared types, prompts, evaluation assets, and deployment configuration to evolve together.

## Top-level Layout

```text
ragpilot/
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
    otel/
  docs/
    api/
    architecture/
    planning/
    product/
    runbooks/
    templates/
  README.md
  package.json
  .env.example
```

## Top-level Responsibilities

### `apps/`

Contains deployable application services. Each application should be independently understandable and should expose a clear runtime boundary.

### `packages/`

Contains shared source assets that may be consumed by multiple applications. Packages should avoid becoming dumping grounds for unrelated helpers.

### `infra/`

Contains deployment, local infrastructure, and observability configuration.

### `docs/`

Contains product, architecture, API, planning, and operational documentation.

## Applications

## `apps/web`

The Next.js application for human-facing product surfaces.

Current route surface:

- `/`
- `/workspace`
- `/admin`

Target route direction:

- `/`
- `/chat`
- `/documents`
- `/agents`
- `/admin`
- `/operations`
- `/sign-in`

Current responsibilities:

- connected platform overview
- operator workspace
- document management
- grounded chat
- conversation history
- workflow status views
- admin governance views

Target product-surface responsibilities:

- `Home` for overview and quick-entry context
- `Chat` for grounded conversations and citations
- `Documents` for document operations and document-context workflow visibility
- `Agents` for future intelligent task experiences, including structured placeholder shells where needed
- `Admin` for governance and control-plane functions
- `Operations` for workflow and execution supervision

Expected future structure:

```text
apps/web/
  app/
    page.tsx
    chat/
      page.tsx
    documents/
      page.tsx
    agents/
      page.tsx
    admin/
      page.tsx
    operations/
      page.tsx
    sign-in/
      page.tsx
  components/
    console/
    home/
    chat/
    documents/
    agents/
    admin/
    operations/
  lib/
    api-client.ts
    formatters/
    auth/
    i18n/
```

Frontend rules:

- route folders use `kebab-case`
- component files use `PascalCase.tsx`
- shared helpers use clear domain naming
- user-facing, operations, and admin surfaces should remain clearly separated
- unfinished but approved product destinations may use explicit UI placeholder surfaces when they preserve the architecture honestly

## `apps/api`

The FastAPI service that acts as the main backend gateway.

Current package root:

```text
apps/api/ragpilot_api/
```

Responsibilities:

- tenant-aware HTTP API routing
- request and response validation
- tenant, workspace, knowledge base, document, retrieval, chat, workflow, and future agent APIs
- workflow triggering and workflow inspection
- model-provider integration boundaries
- trace propagation

Expected future structure:

```text
apps/api/ragpilot_api/
  application/
    identity/
    workspaces/
    knowledge/
    documents/
    conversations/
    retrieval/
    models/
    workflows/
    agents/
    tools/
    administration/
    observability/
  contracts/
    http/
    events/
  domain/
    identity/
    knowledge/
    documents/
    conversations/
    retrieval/
    workflows/
    agents/
  infrastructure/
    database/
    object_storage/
    search/
    embeddings/
    model_providers/
    temporal/
    telemetry/
    tool_integrations/
  presentation/
    http/
      v1/
  shared/
```

Avoid placing business logic directly in HTTP route files.

## `apps/worker`

The Temporal worker service for durable background work.

Current responsibilities:

- document ingestion workflows
- parsing and normalization activities
- chunking activities
- embedding activities
- vector persistence activities
- document reindex support

Expected future structure:

```text
apps/worker/ragpilot_worker/
  workflows/
    document_ingestion_workflow.py
    knowledge_reindex_workflow.py
    evaluation_workflow.py
  activities/
    document_parser_activity.py
    document_chunking_activity.py
    embedding_generation_activity.py
    vector_indexing_activity.py
    lexical_indexing_activity.py
  infrastructure/
    database/
    object_storage/
    search/
    embeddings/
  config.py
  main.py
```

## `apps/mcp-server`

The TypeScript MCP server reserved for explicit tool integration boundaries.

Current state:

- placeholder service boundary
- no production tool surface yet

Expected future responsibilities:

- expose controlled RagPilot tools
- support future agent tool calls
- provide external access to knowledge and retrieval capabilities
- keep tool calls explicit, auditable, and permission-aware
- evolve independently from the main product navigation while remaining compatible with admin-facing `Tools` or `Integrations`

## Shared Packages

## `packages/shared-types`

Shared TypeScript contracts used across frontend and TypeScript services.

## `packages/prompts`

Prompt templates and prompt metadata.

## `packages/evals`

Evaluation datasets, scenarios, and notes.

## Infrastructure

## `infra/docker`

Local Docker Compose and service Dockerfiles.

Current responsibilities:

- PostgreSQL with pgvector
- Redis
- MinIO
- Elasticsearch
- Temporal
- OpenTelemetry collector
- API service
- worker service
- web service

## `infra/k8s`

Future Kubernetes manifests.

## `infra/otel`

OpenTelemetry collector configuration.

## Documentation

## `docs/product`

Product direction and scope.

Current documents:

- `project-blueprint.md`
- `platform-blueprint-reference.md`
- `project-snapshot.md`

## `docs/architecture`

Architecture and implementation decision references.

Current documents:

- `system-overview.md`
- `naming-conventions.md`
- `platform-data-model.md`
- `repository-structure.md`

## `docs/api`

API surface summaries.

Current documents:

- `api-outline.md`

## `docs/planning`

Delivery planning and sequencing.

Current documents:

- `roadmap.md`

## `docs/runbooks`

Operational and local development procedures.

Current documents:

- `local-development.md`

## Placement Rules

Use these rules when adding new files:

1. Product scope belongs in `docs/product`.
2. System design belongs in `docs/architecture`.
3. API summaries belong in `docs/api`.
4. Delivery sequencing belongs in `docs/planning`.
5. Operational steps belong in `docs/runbooks`.
6. User interface code belongs in `apps/web`.
7. HTTP API behavior belongs in `apps/api`.
8. Durable background work belongs in `apps/worker`.
9. Tool integration belongs in `apps/mcp-server`.
10. Shared TypeScript contracts belong in `packages/shared-types`.
11. Prompt assets belong in `packages/prompts`.
12. Evaluation assets belong in `packages/evals`.
13. Deployment and observability configuration belongs in `infra`.

## Decision Rule

When a new module does not have an obvious home, document the intended boundary before adding it. RagPilot should prefer explicit domain ownership over convenience-based placement.
