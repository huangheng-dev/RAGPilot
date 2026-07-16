# RAGPilot

Language: English | [简体中文](./README.zh-CN.md)

[![CI](https://github.com/huangheng-dev/RAGPilot/actions/workflows/ci.yml/badge.svg)](https://github.com/huangheng-dev/RAGPilot/actions/workflows/ci.yml)
[![Release Readiness](https://github.com/huangheng-dev/RAGPilot/actions/workflows/release-readiness.yml/badge.svg)](https://github.com/huangheng-dev/RAGPilot/actions/workflows/release-readiness.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)

RAGPilot is an open-source AI knowledge operations platform for teams operating retrieval-grounded applications. It combines governed source ingestion, permission-aware hybrid retrieval, citation-backed Chat, constrained Agent execution, durable workflows, and runtime administration in one system.

The Web console, API, Workers, persistence model, runtime policy, deployment assets, and release validation are maintained together in a versioned monorepo. RAGPilot is designed around explicit scope, recoverable state, and reviewable evidence.

## Architecture Characteristics

- **Governed knowledge lifecycle:** Data Sources, Documents, immutable versions, Chunks, embeddings, indexing state, synchronization cursors, leases, and recovery history are persisted and operable.
- **Authorization inside retrieval:** tenant, Workspace, Knowledge Base, Document, and Chunk access is enforced at retrieval candidate boundaries, including PostgreSQL reauthorization of Elasticsearch candidates.
- **Constrained Agent execution:** approved Tools, immutable execution snapshots, deployment-capped budgets, optional JSON Schema result contracts, approval, cancellation, retry, and replay remain auditable.
- **Durable operations:** Temporal owns long-running ingestion, source synchronization, and Agent execution state instead of hiding background work inside HTTP requests.
- **Measurable quality:** versioned retrieval datasets, evidence validation, Prompt bindings, Citations, traces, and release gates make runtime changes reviewable.

## Operating Flow

```text
Tenant and identity scope
-> Workspace and Knowledge Base
-> Source registration
-> durable ingestion and search projection
-> authorized retrieval and evidence validation
-> grounded Chat or constrained Agent task
-> operational review, recovery, and evaluation
```

## Product Surfaces

- `Home` — recent activity, active scope, and entry into current work
- `Chat` — streaming grounded answers, Citations, feedback, and conversation history
- `Documents` — file and single-page Web intake, Data Sources, indexing, lifecycle, and recovery
- `Agents` — governed definitions, model and Tool bindings, execution constraints, approval, and replay
- `Admin` — tenant, Workspace, Knowledge Base, member, access, model, Tool, connector, and retrieval governance
- `Operations` — Workflow and Agent execution queues, failures, retry, cancellation, lineage, and diagnostics
- `Settings` — profile, password, active sessions, and personal security actions

## Platform Capabilities

### Knowledge and retrieval

- multi-file upload and durable source registration
- versioned `public_web_v1` single-page synchronization with conditional fetch state, database leases, Temporal orchestration, SSRF protection, and authoritative deletion handling
- parsing and normalization for supported text, structured-data, PDF, DOCX, XLSX, and image formats
- governed OCR for scanned PDFs and supported standalone images
- pgvector semantic recall, Elasticsearch BM25 recall, and PostgreSQL lexical fallback
- governed fusion, reranking, context assembly, and retrieval diagnostics
- Document and Chunk user/group grants enforced during candidate retrieval
- versioned retrieval evaluation contracts covering ranking, isolation, forbidden content, groundedness, Citations, latency, and cost

### Chat and Prompt history

- persisted and searchable conversations with rename and deletion controls
- native SSE deltas for Ollama and OpenAI-compatible providers
- explicit completion-chunk fallback and disconnect cancellation
- persisted final Messages, Citations, feedback, usage evidence, and streaming mode
- immutable Prompt version and rendered-snapshot hash bindings on Chat and Agent history

### Agents, Tools, and Workflows

- persisted Agent definitions, scoped launches, durable executions, and evaluation summaries
- native, HTTP, and MCP Tool registration behind one policy-enforcing runtime
- Tool-call, runtime, and output-size budgets capped by deployment policy
- immutable Agent definition and allowed-Tool sandbox snapshots
- optional JSON Schema terminal-result validation
- durable approval, cancellation, retry, replay lineage, and replay fingerprints
- Workflow Runs, Steps, Events, notes, queue metrics, and operator recovery actions

### Identity, governance, and observability

- backend-issued sessions, local-password authentication, invitation activation, password change/reset, and session revocation
- tenant memberships, role capabilities, Workspace/Knowledge Base scope, Access Groups, and access-event history
- tenant-scoped platform API keys with one-time secret display, hash-only storage, scopes, expiry, revocation, usage tracking, and audit events
- encrypted runtime credentials and governed model, retrieval, Tool, and MCP records
- Redis-backed cross-instance model and MCP concurrency/rate limits
- W3C Trace Context across API, Temporal, Workers, retrieval, model, Agent, Tool, MCP, embedding, and Elasticsearch boundaries
- privacy-safe structured logs, metrics, traces, dashboards, and alert baselines

## Runtime and Integration Status

Core runtime components:

| Component | Role |
| --- | --- |
| Next.js | Web product and operator surfaces |
| FastAPI | HTTP contracts, authorization, and domain orchestration |
| PostgreSQL / pgvector | business source of truth and semantic retrieval |
| Temporal | durable Workflow and Agent execution history |
| Elasticsearch | rebuildable lexical/search projection and BM25 recall |
| Redis | distributed runtime limits and ephemeral coordination |
| MinIO | original and derived document assets |
| OpenTelemetry stack | correlated logs, metrics, traces, and diagnostics |

Active integration paths:

- native Ollama Chat
- OpenAI-compatible Chat and embeddings, including governed vLLM-compatible endpoints
- Streamable HTTP MCP client discovery, Tool mapping, and Agent invocation
- read-only `stdio` MCP server for scoped knowledge search, Document inspection, and Workflow inspection

Optional pilot lanes:

- `LlamaIndex` retrieval comparison behind the retrieval-engine contract
- `LangGraph` bounded in-run graph execution inside Temporal-owned durable Agent workflows

Pilot dependencies are not mandatory platform foundations, and their presence does not imply promotion to the default runtime path.

## Version Scope

- the built-in Web connector synchronizes one public page per Data Source; it is not a crawler
- OCR supports scanned PDFs and listed standalone image formats but does not claim complete complex-layout or table reconstruction
- local-password authentication is runnable; deployment-owned OIDC/SAML callback and operational closure are environment-specific evolution work
- the Kubernetes manifests are a production-oriented baseline, not a claim that an unconfigured checkout is ready for public traffic
- provider-neutral reranking and broader framework lanes require evaluation evidence before promotion

Current implementation details are maintained in the [Project Snapshot](./docs/product/project-snapshot.md). Durable architecture rules are defined in the [Project Blueprint](./docs/product/project-blueprint.md), and engineering evolution priorities are maintained in the [Roadmap](./docs/planning/roadmap.md).

## Local Development

Prerequisites:

- Node.js 20 or newer and npm
- Python 3.10 or newer
- Docker Desktop or a compatible Docker Compose environment
- optional Ollama or OpenAI-compatible endpoint for non-deterministic model execution

1. Copy `.env.example` to `.env` and replace development credentials before shared use.
2. Install repository dependencies:

```bash
npm install
```

3. Start stable local mode:

```bash
npm run stable:mode:up
```

Stable mode keeps infrastructure dependencies in Docker while running the Web and API through managed host processes. RAGPilot does not publish a universal production account or password; identities, Secrets, model endpoints, and runtime credentials are provisioned per environment.

Default local endpoints are configurable through `.env`:

- Web: `http://localhost:3000`
- API: `http://localhost:8000`
- Temporal UI: `http://localhost:8080`
- Temporal gRPC: `localhost:7233`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- Elasticsearch: `http://localhost:9200`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`

These are repository defaults. If a host port is already owned by another application, override only the corresponding `RAGPILOT_*_PORT` value in `.env`; container-internal service ports remain unchanged.

For full-container validation:

```bash
npm run compose:up:detached
```

For detailed setup, migration, validation, and troubleshooting instructions, use the [Local Development Runbook](./docs/runbooks/local-development.md).

## Production Deployment

RAGPilot includes a production-oriented delivery baseline:

- production-mode container builds for Web, API, Document Worker, and Agent Worker
- Kubernetes manifests with a database migration Job, probes, resources, ingress, scaling/disruption controls, and external Secret integration
- a production environment template in [`.env.production.example`](./.env.production.example)
- OpenTelemetry, Prometheus, Tempo, Grafana, dashboard, and alert configuration
- release, backup/restore, reliability, and publishing helpers under [`infra/scripts`](./infra/scripts)

Deployment operators remain responsible for selecting and closing the identity mode, supplying real images and Secrets, configuring trusted origins and managed dependencies, validating migrations and model reachability, and exercising backup/restore, capacity, telemetry retention, incident response, and disaster recovery in the target environment.

See the [Kubernetes Deployment Baseline](./infra/k8s/README.md) and [Production Reliability Runbook](./docs/runbooks/production-reliability.md).

## Release Workflow

Run the unified release gate before tagging or publishing:

```bash
npm run release:status
npm run release:preflight
```

The preflight validates:

- public documentation and Markdown links
- Web lint, type safety, and production build
- production Node dependency policy
- API and Worker tests plus migration completeness
- deterministic and real-database retrieval regression gates
- MCP build and protocol tests
- authenticated browser E2E behavior
- public candidate files, delivery assets, and common secret-leakage patterns

API route and ORM table documentation are also checked against the running FastAPI and SQLAlchemy contracts.

## Documentation

- [Technical documentation index](./docs/README.md)
- [Project Snapshot](./docs/product/project-snapshot.md)
- [Project Blueprint](./docs/product/project-blueprint.md)
- [System Overview](./docs/architecture/system-overview.md)
- [API Outline](./docs/api/api-outline.md)
- [Roadmap](./docs/planning/roadmap.md)
- [Contribution Guide](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)
- [Changelog](./CHANGELOG.md)

## License

RAGPilot is licensed under [Apache-2.0](./LICENSE).
