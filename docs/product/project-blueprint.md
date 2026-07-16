# RAGPilot Project Blueprint

## Purpose

This blueprint defines RAGPilot's durable product principles, target architecture, and decision boundaries. Current implementation status is intentionally maintained elsewhere so that long-term direction and verified behavior remain distinct.

Documentation authority is intentionally separated:

- [Project Snapshot](./project-snapshot.md) records verified current behavior.
- [Roadmap](../planning/roadmap.md) records prioritized engineering evolution.
- [System Overview](../architecture/system-overview.md) explains the realized runtime architecture.
- [API Outline](../api/api-outline.md) and [Platform Data Model](../architecture/platform-data-model.md) inventory current contracts.

The blueprint is not a status report, changelog, or historical implementation plan.

## Product Position

RAGPilot is an open-source AI knowledge operations platform for teams that need to ingest governed knowledge, retrieve it with enforceable scope, produce traceable answers, run constrained Agents, and operate the complete lifecycle through durable workflows.

Its defining concern is operational trust:

- who may retrieve which knowledge;
- how source and index state remain synchronized;
- what evidence supports an answer;
- which model, Prompt, Tool, and policy produced a result;
- how long-running work is retried, cancelled, approved, recovered, or replayed;
- how quality and isolation regressions are blocked before release.

RAGPilot is not designed as a consumer social-chat product, unrestricted autonomous-agent host, generic no-code workflow builder, or wrapper around one model vendor.

## Target Users

### Platform administrators

Operate tenant identity, access, runtime credentials, model endpoints, Tools, integrations, policy, health, and delivery posture.

### Knowledge operators

Register sources, manage documents and versions, monitor ingestion and indexing, inspect failures, and maintain retrieval quality.

### Knowledge users

Ask scoped questions, inspect citations, continue conversations, provide feedback, and launch approved Agent tasks.

### Developers and integrators

Extend providers, parsers, connector adapters, retrieval engines, Tool integrations, evaluation suites, and deployment overlays through explicit contracts.

## Product Principles

### Governed by default

Authentication, tenancy, authorization, credentials, Tool policy, execution budgets, and audit evidence are backend-owned contracts. Browser state must not become an authorization source of truth.

### Durable before autonomous

Long-running ingestion, synchronization, and Agent work must have persisted identity, state, retry/cancellation behavior, and operator-visible lineage before more autonomy is added.

### Evidence before claims

Answers, retrieval changes, Prompt changes, provider promotion, and framework pilots must be supported by citations, diagnostics, evaluation data, or release gates. Installing a dependency is not completion.

### One business source of truth

PostgreSQL owns durable business and governance state. pgvector and Elasticsearch are rebuildable retrieval projections, not competing records of truth.

### Explicit runtime boundaries

Model providers, retrieval engines, Tool runtimes, MCP integrations, parsers, and connectors remain replaceable behind domain contracts. Framework-specific behavior must not leak across the platform.

### Lean product surfaces

The visible product should close real user and operator tasks without turning internal architecture, diagnostics, or every configuration option into a separate page.

### Open-source operability

Another team should be able to understand, run, validate, secure, and extend the repository without private institutional knowledge.

## Differentiating Architecture

RAGPilot's target architecture preserves five connected control loops:

```text
Source lifecycle
-> governed ingestion and synchronization
-> authorized hybrid retrieval
-> grounded Chat or constrained Agent execution
-> evidence, evaluation, and operational follow-up
```

The platform is differentiated when all five loops remain connected. A UI-only feature, isolated framework adapter, or ungoverned runtime path does not satisfy the blueprint.

## Product Domains

### Identity and access

The platform must support:

- backend-issued sessions and deployment-selected identity-provider integration;
- tenant membership, roles, capabilities, and access review;
- workspace and Knowledge Base scope;
- Access Groups and user/group grants at Document and Chunk retrieval boundaries;
- scoped platform API keys with hash-only storage, expiry, revocation, usage, and audit history;
- explicit emergency revocation and credential-rotation operations.

Every protected data path must resolve an authenticated actor and enforce current membership and resource scope in the backend.

### Knowledge sources and documents

Knowledge intake must be a governed lifecycle rather than an upload side effect:

```text
Source registration
-> discovery or upload
-> immutable Document version
-> parse and normalize
-> Chunk and embed
-> project and validate
-> synchronize, rebuild, archive, or delete
```

The source model must preserve stable external identity, connector version, cursor, lease, synchronization state, run history, and error evidence. Connector adapters must be versioned, idempotent, network-safe, and explicit about authoritative deletion semantics.

Single-page Web import must not be presented as full-site crawling. New multi-item connectors are justified only by a proven product workflow and the same safety contract.

### Retrieval and evidence

Retrieval must combine:

- tenant- and scope-safe semantic recall through pgvector;
- rebuildable lexical recall through Elasticsearch with a PostgreSQL fallback;
- governed fusion, deduplication, reranking, and context budgeting;
- candidate-set authorization before final result exposure;
- citation and evidence validation;
- persisted diagnostics and evaluation outcomes.

Target flow:

```text
Scoped query
-> authorized semantic + lexical candidate recall
-> governed fusion and rerank
-> context assembly
-> grounded generation
-> citation/evidence validation
-> persisted diagnostics and feedback
```

Provider-neutral reranking or alternate retrieval frameworks may be promoted only when versioned evaluation data demonstrates improvement without weakening isolation, latency, cost, or fallback behavior.

### Chat and Prompt governance

Chat must provide persisted conversations, streaming responses, citations, feedback, searchable history, and explicit knowledge scope.

Every generated result should retain enough immutable runtime evidence to identify the selected model endpoint, Prompt version, rendered Prompt hash, retrieval profile, source citations, usage, and streaming mode without persisting secrets or unnecessary private context.

### Models and runtime credentials

All hosted and self-hosted model paths must pass through a model gateway that owns provider selection, capability checks, timeouts, retry, fallback, streaming, usage/cost evidence, concurrency/rate limits, health posture, and encrypted credential references.

No product page should depend directly on provider-specific request or response formats.

### Tools, MCP, and Agents

Agents are governed task executors, not unrestricted scripts.

Every Agent execution must have:

- explicit tenant, Workspace, Knowledge Base, model, Prompt, and Tool scope;
- an immutable definition and allowed-Tool snapshot;
- deployment-capped Tool-call, runtime, and output budgets;
- schema validation when a structured output contract is declared;
- durable status, cancellation, approval, retry, and replay lineage;
- auditable Tool inputs/outputs with credential and private-data redaction;
- a deterministic replay identity where replay is supported.

Native, HTTP, and MCP Tools must execute through one policy-enforcing Tool Runtime. MCP is an integration protocol under Tools and Integrations, not a top-level product destination. The standalone server and outbound client paths must never bypass API authorization, tenant isolation, or audit policy.

Temporal owns durable workflow semantics such as retries, timers, cancellation, approval waits, and history. LangGraph may own bounded in-run graph transitions only when branching and checkpointing provide measurable value; it must not replace Temporal's durable ownership.

Framework selection is durable domain policy rather than a process-wide feature flag. Agent definitions must version their selected in-run runtime, Retrieval Profiles must version their selected post-processor policy, and executions must retain the effective versions used. Optional dependencies may be omitted from a deployment, but health and governance contracts must surface any persisted policy that cannot run there.

### Evaluation and release quality

Quality must be versioned and testable. Evaluation contracts should cover:

- ranking and retrieval relevance;
- tenant and Knowledge Base isolation;
- stale, deleted, or forbidden content;
- groundedness and citation integrity;
- latency, cost, and fallback posture;
- Agent output contracts and Tool policy;
- migration, API, Worker, Web, MCP, and authenticated browser behavior.

High-value quality gates belong in CI and release preflight rather than optional manual checklists.

### Observability and operations

One trace identity should connect HTTP requests, Temporal workflows, Worker activities, retrieval, parsing, embedding, model, Agent, Tool, MCP, and search-projection operations.

Structured logs, metrics, traces, audit events, workflow history, and operator views must remain correlated while avoiding raw credentials and unnecessary document content. Production deployments must define retention, sampling, alert routing, ownership, backup/restore, capacity, and disaster-recovery policy for their environment.

## Application Surfaces

### Primary navigation

- `Home` — concise operating context and entry into active work
- `Chat` — scoped grounded conversations and citations
- `Documents` — source intake, lifecycle, indexing, and recovery
- `Agents` — governed definitions, execution, approval, and review

### Governance and operations

- `Admin` — tenant, Workspace, Knowledge Base, identity, access, model, Tool, connector, retrieval, and runtime governance
- `Operations` — workflow and execution queues, failures, retry, cancellation, lineage, and diagnostics
- `Settings` — profile, session security, and user-specific preferences

Compatibility routes may preserve deep links but must not redefine the product model. Advanced configuration should live beside the resource it governs. New pages are justified only when an existing surface cannot close the operator task clearly.

## Service Boundaries

### Web

Renders user and operator workflows, consumes backend-owned policy, and preserves scope in navigable URLs. It must not duplicate authorization or runtime policy in client-only state.

### API

Owns HTTP contracts, actor resolution, authorization, domain orchestration, transaction boundaries, runtime policy, workflow launch, and audit evidence.

### Document Worker

Owns durable source synchronization, parsing, OCR, normalization, chunking, embedding, search projection, reconciliation, and related workflow state transitions.

### Agent Worker

Owns durable execution of persisted Agent snapshots under declared budgets, Tool policy, output contracts, approval state, and replay lineage.

### MCP Server

Exposes a deliberately small, permission-aware Tool surface to compatible MCP hosts through scoped API access. Remote serving and mutation Tools require their own deployment-grade authentication and governance closure before promotion.

## Data and Infrastructure Boundaries

- PostgreSQL: business truth, identity, governance, workflow references, and pgvector semantic projection
- Elasticsearch: rebuildable lexical and retrieval-oriented projection
- Redis: distributed concurrency/rate coordination and ephemeral runtime controls
- MinIO or compatible object storage: original and derived document assets
- Temporal: durable workflow history and execution semantics
- OpenTelemetry stack: correlated telemetry transport and diagnosis
- Kubernetes or equivalent: environment-specific deployment, migration, health, scaling, and disruption controls

Schema additions require a closed product requirement. New tables must extend stable aggregates instead of duplicating Message, Document, Agent Execution, Retrieval Evaluation, or governance-event records.

## Product Simplification Rule

Before adding a capability or page, verify that it:

1. closes a real user or operator task;
2. belongs to a named domain and service boundary;
3. has backend behavior and durable state where required;
4. preserves tenant isolation and policy enforcement;
5. is testable, observable, and diagnosable;
6. improves the main knowledge-to-evidence loop more than it increases surface complexity.

Defer decorative dashboards, duplicate control panels, speculative plugin marketplaces, unrestricted Tool exposure, framework branding without a closed path, fine-tuning management, billing, and heavy analytics until demonstrated demand outweighs their maintenance and governance cost.

## Completion Rule

A target capability is complete only when the applicable runtime behavior, persisted state, authorization, governance visibility, automated tests, deployment configuration, documentation, and operator diagnostics agree.

Strong blueprint capabilities should be implemented when they materially improve reliability, security, quality, or extensibility. Weak or ornamental capabilities should be removed from the blueprint rather than implemented for appearance.

## Success Definition

RAGPilot succeeds when another team can deploy and operate a real knowledge system in which:

- sources and Documents have durable, recoverable lifecycles;
- retrieval is authorized, measurable, and explainable;
- answers expose usable evidence;
- Agents run inside explicit, reviewable boundaries;
- workflows survive retries, cancellation, and operator intervention;
- runtime choices and quality changes remain traceable;
- the repository stays understandable and extensible for external contributors.
