# RagPilot Platform Blueprint Reference

## Purpose

This document is the single-page reference for the RagPilot product blueprint, repository structure, and technology stack.

Use this document when:

- reviewing the overall direction of the project
- checking whether implementation work still matches product intent
- onboarding future contributors
- deciding where a new module or feature should live

This document complements, but does not replace:

- [Project Blueprint](./project-blueprint.md)
- [System Overview](../architecture/system-overview.md)
- [Repository Structure](../architecture/repository-structure.md)
- [Platform Data Model](../architecture/platform-data-model.md)
- [Naming Conventions](../architecture/naming-conventions.md)

## Product Blueprint

### Product identity

RagPilot is an English-first, open-source, production-oriented AI knowledge platform.

It is not intended to be:

- a consumer chat toy
- a landing-page-style AI demo
- a thin wrapper around a single model provider
- a clone of any legacy PHP project

It is intended to become:

- a knowledge operations platform
- a RAG application foundation
- a retrieval-grounded chat backend with citations
- a workflow-driven system for ingestion, indexing, evaluation, and model governance

### Active product direction

The current implementation direction is operations-first.

Current priority areas:

- administrator console foundations
- tenant, workspace, and knowledge base management
- document ingestion and document operations
- workflow visibility and workflow recovery
- grounded chat with citations
- resource lifecycle management

Current non-priorities:

- decorative marketing pages
- consumer social chat patterns
- premature heavy agent abstractions
- unrelated feature branches that do not strengthen the core RAG path

### Main product domains

RagPilot is organized around these core domains:

1. Identity and tenancy
2. Workspaces and knowledge bases
3. Document management
4. Ingestion workflows
5. Retrieval
6. Chat and citations
7. Model gateway
8. Agents and tools
9. Evaluation
10. Observability and operations

### Main application surfaces

#### Web console

Primary human-facing interface for:

- chat
- document operations
- workflow monitoring
- resource management

#### Admin console

Operational management surface for:

- tenants
- workspaces
- knowledge bases
- lifecycle controls
- audit and usage in later phases

#### API service

Main backend gateway for:

- validation
- orchestration
- retrieval-backed chat
- workflow triggering
- tenant-aware resource access

#### Worker service

Background execution surface for:

- durable ingestion
- chunking
- embedding
- indexing
- reindex workflows

#### MCP server

Future controlled integration surface for:

- tool exposure
- compatible clients
- future agent tool interactions

## Current Implementation Snapshot

### Already implemented

- monorepo foundation
- English-first naming system
- product and architecture documentation
- Docker-based local infrastructure
- FastAPI API foundation
- Next.js operator workspace
- Temporal-backed ingestion workflow
- document upload and storage flow
- chunk and embedding persistence
- retrieval-backed grounded chat
- stored conversations, messages, and citations
- document reindex using new document versions
- workflow retry with lineage support
- admin-style context switching for tenant, workspace, and knowledge base
- create and edit for tenant, workspace, and knowledge base
- workspace archive lifecycle
- knowledge base publication lifecycle

### Not yet complete

- authentication and RBAC
- full user and membership management
- rich parser coverage for office and web sources
- hybrid retrieval and rerank
- evaluation center
- model governance surface
- mature MCP and agent workflows
- production CI/CD and full observability maturity
- frontend decomposition into smaller maintainable modules

## Delivery Stage

RagPilot is currently between:

- late Phase 2 / Phase 3 completion
- early Phase 4 consolidation

In practical terms, the platform already has a usable core path, but it is still in the stage of hardening the management surface and product boundaries.

## Repository Structure

## Root layout

```text
RagPilot/
  apps/
  docs/
  infra/
  packages/
  work/
  .env.example
  package.json
  README.md
```

### `apps/`

Application services.

```text
apps/
  api/         # FastAPI backend
  mcp-server/  # future integration service
  web/         # Next.js web console
  worker/      # Temporal worker
```

#### `apps/web`

Current operator and admin-style workspace.

Responsibilities:

- context switching
- resource management actions
- chat
- document inspection
- workflow inspection

#### `apps/api`

Current business API.

Responsibilities:

- resource APIs
- chat APIs
- workflow APIs
- document operations
- health and orchestration boundaries

#### `apps/worker`

Background execution service.

Responsibilities:

- ingestion workflows
- parsing
- chunk creation
- embedding creation
- background indexing work

#### `apps/mcp-server`

Reserved for controlled external tool integration and future MCP-facing capabilities.

### `docs/`

Project documentation.

```text
docs/
  architecture/
  product/
  runbooks/
```

#### `docs/architecture`

- `naming-conventions.md`
- `platform-data-model.md`
- `repository-structure.md`
- `system-overview.md`

#### `docs/product`

- `project-blueprint.md`
- `platform-blueprint-reference.md`

#### `docs/runbooks`

- `local-development.md`

### `infra/`

Infrastructure definitions.

```text
infra/
  docker/
  k8s/
  otel/
```

#### `infra/docker`

- `compose.yaml`
- `api.Dockerfile`
- `web.Dockerfile`
- `worker.Dockerfile`

#### `infra/k8s`

Reserved for future production deployment manifests.

#### `infra/otel`

OpenTelemetry collector configuration.

### `packages/`

Shared cross-service assets.

```text
packages/
  evals/
  prompts/
  shared-types/
```

#### `packages/shared-types`

Reserved for cross-service or cross-surface typed contracts.

#### `packages/prompts`

Reserved for prompt templates and prompt version assets.

#### `packages/evals`

Reserved for evaluation datasets and evaluation notes.

### `work/`

Local work area for implementation support and scratch artifacts.

It is not a core product module.

## Technology Stack

### Frontend

- `Next.js 15`
- `React 19`
- `TypeScript`
- `Tailwind CSS`

Current role:

- operator workspace
- admin-style management surface
- chat/document/workflow UI

### Backend API

- `FastAPI`
- `Python 3.10`
- `Pydantic`
- `SQLAlchemy 2`
- `asyncpg`

Current role:

- resource APIs
- chat orchestration
- deterministic, OpenAI-compatible, and native `Ollama` model routing
- retrieval orchestration
- workflow control endpoints

### Background workflows

- `Temporal`
- Python worker runtime

Current role:

- durable ingestion
- reindex orchestration
- retryable background execution

### Data and storage

- `PostgreSQL`
- `pgvector`
- `Redis`
- `MinIO`
- `Elasticsearch`

Current role:

- relational system of record
- vector search
- cache / queue support
- object storage for uploaded assets
- future lexical and hybrid retrieval

### Observability

- `OpenTelemetry`

Current role:

- collector configuration foundation
- future traces, logs, and metrics expansion

### Local infrastructure and packaging

- `Docker Compose`
- service-specific Dockerfiles
- root `npm` scripts for local orchestration

### Testing

- `pytest` for API-side validation
- `next build` for frontend type/build verification

## Current Local Runtime Targets

Primary local ports:

- Web: `3001`
- API: `18000`
- PostgreSQL: `5433`
- Redis: `6380`
- MinIO API: `9002`
- MinIO Console: `9003`
- Temporal UI: `8081`

These port choices intentionally avoid conflicts with other local projects.

## Build Rules

When implementing new work:

1. follow English-first naming
2. keep domain boundaries explicit
3. prefer resource-oriented APIs
4. make background work visible and recoverable
5. keep admin and operator workflows central
6. avoid borrowing legacy project names or structures
7. update documentation when the product boundary changes

## Recommended Reading Order

For product direction:

1. [Project Blueprint](./project-blueprint.md)
2. [Platform Blueprint Reference](./platform-blueprint-reference.md)

For engineering structure:

1. [System Overview](../architecture/system-overview.md)
2. [Repository Structure](../architecture/repository-structure.md)
3. [Platform Data Model](../architecture/platform-data-model.md)
4. [Naming Conventions](../architecture/naming-conventions.md)

For local execution:

1. [Local Development Runbook](../runbooks/local-development.md)
