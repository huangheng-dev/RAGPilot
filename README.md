# RAGPilot

Language: English | [简体中文](./README.zh-CN.md)

RAGPilot is an open-source AI knowledge operations platform for teams that need governed knowledge ingestion, retrieval-grounded chat, agent execution, workflow supervision, and platform administration in one system.

It is built for real production workflows rather than isolated chat demos. The product combines knowledge access, document processing, retrieval diagnostics, citation-backed answers, long-running workflow execution, model governance, and operator-facing control surfaces into a single platform.

The current release provides a complete operator workflow from scoped knowledge intake to governed answers and operational follow-up. Its web console, API, worker, persistence layer, runtime controls, deployment assets, and release checks are maintained as one versioned product surface.

## What RAGPilot Delivers

- retrieval-grounded chat with citations and persisted conversation history
- governed knowledge-source intake across file assets and URL-based single-page web content import
- document ingestion across upload, parsing, chunking, indexing, reindex, lifecycle review, and failure recovery
- durable workflow execution with queueing, retry, lineage tracking, and operational follow-up
- agent management with governed runtime handoff, task orchestration, and tool-aware execution boundaries
- tenant, workspace, knowledge base, and member governance for multi-scope operations
- model, retrieval, tool, and runtime credential control surfaces for consistent execution behavior
- English-first product structure with Simplified Chinese support

## Product Areas

RAGPilot keeps the visible product focused on the main operating path:

- `Home` for a concise overview of recent chats, documents, and agents
- `Chat` for grounded question answering with traceable sources
- `Documents` for multi-file or web-page intake, knowledge-base filtering, indexing, and lifecycle operations
- `Agents` for governed agent definitions, model and tool bindings, execution entry, and review
- `Admin` for tenant directories, workspaces, knowledge bases, members, access, and runtime governance
- `Operations` for platform-wide workflow supervision, queue visibility, retry handling, and run inspection
- `Settings` for profile, active-session, and password management

## Core Operating Flow

```text
Tenant
-> Workspace
-> Knowledge Base
-> Source Registration
-> Document Ingestion
-> Durable Workflow Execution
-> Retrieval Validation
-> Grounded Chat or Agent Task
-> Operational Follow-up and Governance
```

## Platform Capabilities

### Knowledge Ingestion

- document upload and source registration
- URL-based single-page web content import
- parsing, normalization, chunking, and embedding
- hybrid retrieval with vector persistence, Elasticsearch BM25, and PostgreSQL fallback
- document versioning, rebuild, and status tracking

RAGPilot treats knowledge intake as a governed lifecycle:

```text
Source
-> Ingest
-> Parse
-> Chunk
-> Index
-> Retrieve
-> Validate
-> Rebuild or Archive
```

### Retrieval and Chat

- hybrid retrieval across semantic and keyword signals
- rerank and context assembly
- source citation return and answer traceability
- persisted, searchable conversation history with rename and deletion controls
- knowledge-scope selection at workspace and knowledge-base level
- lightweight conversational intent handling that avoids irrelevant retrieval for greetings

### Agents and Workflows

- agent definition management
- long-running workflow execution and recovery
- structured runtime handoff between retrieval, tools, and task steps
- operator-visible retry, cancellation, and lineage review

Agents in RAGPilot are governed task executors. They are expected to run with explicit scope, approved tools, traceable steps, and reviewable outputs rather than open-ended autonomous behavior.

### Governance and Runtime Control

- tenant and workspace scoping
- member invitation, activation, and access review
- formal authentication-mode contracts across local directory, password-local, OIDC, and SAML provider-managed sign-in boundaries
- retrieval profile and model endpoint governance
- tool inventory management across native, HTTP, and MCP-oriented integrations
- runtime credential, connector, and binding governance without exposing raw secret values

## Architecture

RAGPilot uses a multi-service monorepo layout:

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
    otel/
```

## Runtime Stack

Core runtime:

- `Next.js`
- `FastAPI`
- `Temporal`
- `PostgreSQL`
- `pgvector`
- `Redis`
- `MinIO`

Implemented architecture baselines:

- `Elasticsearch`: versioned Chunk projection, lifecycle synchronization, scoped Backfill, exact rebuild validation, atomic read/write Alias cutover, tenant-safe BM25 retrieval, PostgreSQL fallback, and projection diagnostics are active
- `OpenTelemetry`: correlated traces, metrics, and logs across API, Worker, and Agent execution, backed by the Collector, Prometheus, and Tempo

## Integration Layer

RAGPilot includes active governed integration paths for:

- `Ollama`
- `vLLM`
- `LlamaIndex` retrieval pilot lane
- `LangGraph` workflow-recovery pilot lane

RAGPilot also includes a governed Streamable HTTP `MCP` client path for connector discovery, tool mapping, and Agent invocation. The standalone MCP server package remains a reserved outbound-server boundary.

All of these integrations sit behind explicit runtime selection, configuration, and governance boundaries.
The shipped Docker API baseline includes the optional `LlamaIndex` and `LangGraph` dependencies required for pilot execution and readiness checks; dependency presence does not imply production promotion.

## Repository Conventions

- English-first naming across code, APIs, persistence, and product structure
- explicit domain naming instead of vague utility naming
- backend routes and services organized by product domain
- durable backend state instead of UI-only simulation
- lean visible surfaces aligned to the main user flow

## Local Development

Prerequisites:

- Node.js and npm
- Python 3.11 or newer
- Docker Desktop or a compatible Docker Compose environment
- an optional Ollama or OpenAI-compatible endpoint when using a non-deterministic chat model

1. Copy `.env.example` to `.env` and replace development credentials before shared or production use.
2. Install repository dependencies with `npm install`.
3. Start RAGPilot in stable local mode:

```bash
npm run stable:mode:up
```

This mode keeps dependency services in Docker while running the web and API through stable host processes.

RAGPilot does not publish a default production account or password. Authentication users, secrets, model endpoints, and runtime credentials must be provisioned for each environment.

Default local targets:

- Web: `http://localhost:3001`
- API: `http://localhost:18000`
- Temporal UI: `http://localhost:8081`
- Temporal gRPC: `localhost:7234`
- PostgreSQL: `localhost:5433`
- Redis: `localhost:6380`
- Elasticsearch: `http://localhost:9201`
- MinIO API: `http://localhost:9002`
- MinIO Console: `http://localhost:9003`

For full-stack container verification:

```bash
npm run compose:up:detached
```

For frontend-only work:

```bash
npm install
npm run web:serve
```

## Production Deployment

RAGPilot ships with a production-delivery baseline rather than only local development scaffolding. Operators remain responsible for environment-specific security hardening, secret management, backups, observability retention, capacity planning, and disaster recovery.

Delivery assets included in this repository:

- production-ready container images for `web`, `api`, and `worker`
- Kubernetes baseline manifests under [`infra/k8s`](./infra/k8s)
- production environment template in [`.env.production.example`](./.env.production.example)
- release validation and publish automation helpers under [`infra/scripts`](./infra/scripts)

The default production topology is:

```text
Ingress
-> Web
-> API
-> Worker
-> PostgreSQL / Redis / MinIO / Temporal
-> Elasticsearch (lifecycle projection, atomic rebuild, BM25 recall, and diagnostics active)
```

For Kubernetes-oriented rollout:

1. prepare your own secret manifest from [`infra/k8s/secret.example.yaml`](./infra/k8s/secret.example.yaml)
2. replace placeholder image references such as `ghcr.io/your-org/ragpilot-api:0.1.0`
3. point [`infra/k8s/configmap.yaml`](./infra/k8s/configmap.yaml) at your real managed dependency endpoints
4. apply the manifests through [`infra/k8s/kustomization.yaml`](./infra/k8s/kustomization.yaml)

Before exposing an environment publicly, configure trusted origins, replace all template secrets, provision authentication identities, verify model endpoint reachability, apply database migrations, and run the release preflight.

## Release Quality

The release gate covers the public documentation set, Markdown links, frontend lint and type safety, the optimized web build, API tests, authenticated core-surface browser checks, deployment assets, and common secret-leakage patterns. These checks are intended to keep product behavior, documentation, and deployment configuration aligned before a release is tagged.

## Release Workflow

RAGPilot keeps public release work on one unified preflight path:

```bash
npm run release:status
npm run release:preflight
```

The preflight flow audits:

- public root documentation
- public markdown links
- web build integrity
- API tests
- candidate public file set
- production delivery assets
- basic secret leakage patterns

Useful release helpers:

- `npm run release:help`
- `npm run release:delivery-audit`
- `npm run release:first-push`
- `npm run release:first-tag`
- `npm run release:promote`

## Open-Source Documentation

- contribution guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- security policy: [SECURITY.md](./SECURITY.md)
- release history: [CHANGELOG.md](./CHANGELOG.md)

## License

RAGPilot is licensed under [Apache-2.0](./LICENSE).
