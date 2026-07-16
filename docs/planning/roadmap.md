# RAGPilot Roadmap

## Purpose

This is the only active list of incomplete product and architecture work.

- Target boundaries belong in `../product/project-blueprint.md`.
- Implemented behavior belongs in `../product/project-snapshot.md`.
- Superseded phases, rollout plans, checklists, and one-time evidence are removed after their durable conclusions are consolidated.

An item leaves this roadmap only after runtime behavior, persistence, governance, tests, deployment configuration, and operator diagnostics agree where those dimensions apply.

## Current Baseline

The following capabilities are implemented and must not be reported as missing core work:

- PostgreSQL and pgvector source-of-truth retrieval with Elasticsearch BM25 projection, fusion, reranking, lifecycle reconciliation, and PostgreSQL lexical fallback
- optional `llamaindex_pilot` retrieval and bounded `langgraph_pilot` agent-runtime lanes behind explicit engine boundaries
- Temporal-backed ingestion and Agent execution with cancellation, retry/replay lineage, immutable execution-policy snapshots, deployment-owned budgets, and optional JSON Schema result validation
- governed Streamable HTTP MCP discovery, tool mapping, preview, approval, and Agent invocation
- read-only `stdio` MCP tool delivery for tenant-safe knowledge search, document inspection, and workflow inspection
- encrypted runtime credentials and Redis-backed cross-instance model/MCP concurrency and request-rate limits
- correlated W3C Trace Context across API, Temporal, Worker, retrieval, model, Agent, and tool boundaries
- privacy-safe structured JSON logs, OTLP log export, metrics, dashboards, alert baselines, and operator runbooks
- versioned retrieval evaluation data with groundedness, citation, cost, latency, and ranking regression gates in CI and release preflight
- versioned Prompt records bound to Message, Agent Run, and Agent Execution history
- tenant-scoped platform API keys with hashed secrets, scopes, expiry, revocation, usage tracking, and audit events
- SSE chat delivery with incremental web rendering and persisted final messages
- provider-native Ollama/OpenAI-compatible streaming with completion fallback and disconnect cancellation
- scanned-PDF and standalone-image OCR with governed format and pixel boundaries
- durable Data Source identity, document binding, synchronization cursor/status, run history, and legacy backfill
- versioned connector SPI and active SSRF-guarded `public_web_v1` incremental sync with database leases, Temporal child ingestion, and Documents-surface operation
- tenant Access Groups and document/Chunk user-or-group ACL enforcement in retrieval
- authenticated browser smoke testing, production Web builds, API/Worker suites, and stable-mode startup validation
- health-gated Compose startup across PostgreSQL, Redis, Temporal, API, and dependent Workers

## Active Priorities

### P0 — Production identity and access closure

- select the deployed authentication mode: governed local password or an external identity provider
- finish external provider callback, logout, claim mapping, and session-revocation operations where that deployment mode is selected
- add operator-facing API-key management if API keys must be administered outside the API contract
- define rotation, emergency revocation, and ownership policy for model and MCP credentials

### P0 — Production reliability

- validate backup and restore for PostgreSQL, MinIO, Elasticsearch projections, and required secrets
- define production telemetry retention, sampling, alert routing, and incident ownership
- run capacity, dependency-failure, recovery-time, and disaster-recovery exercises in the target deployment environment
- keep Kubernetes and managed-service deployment overlays aligned with the verified stable-mode contract

### P1 — Retrieval and document depth

- expand versioned evaluation datasets with representative production-like queries, adversarial tenant-isolation cases, and larger regression baselines
- promote provider-neutral reranking only when it beats the deterministic fallback under those gates
- deepen the active scanned-PDF and standalone-image OCR plus DOCX/XLSX parsers for complex layouts and tables where product demand justifies it
- add additional multi-item connector adapters only for proven product demand; each adapter must satisfy the existing lease, cursor, idempotency, network-safety, and authoritative-snapshot contract

### P1 — Streaming and Agent runtime depth

- add optional legacy MCP SSE compatibility only when a supported integration requires it
- expand LangGraph beyond bounded lanes only when graph branching, checkpointing, approval, and output validation are visible and testable

### P2 — Governance experience

- expose Prompt version comparison, activation, rollback, and import/export only if operators need to manage authored assets in product surfaces
- deepen API-key, credential, model, MCP, Data Source, and evaluation audit views without duplicating backend policy in the browser
- keep resource ownership, reason, actor, and lifecycle evidence queryable through tenant-safe contracts

## Explicit Non-Goals

- replacing PostgreSQL as the business source of truth
- making LlamaIndex or LangGraph mandatory platform foundations
- exposing unrestricted MCP tools to Agents
- adding framework names without a closed product path
- adding low-value dashboard or orchestration surfaces that do not close an operator workflow

## Update Rule

For every material closure:

1. update `project-snapshot.md` with the verified current behavior;
2. remove or narrow the corresponding roadmap item;
3. update the API, data-model, architecture, and runbook documents that own the affected contract;
4. remove superseded planning documents after their durable conclusions are consolidated, rather than retaining competing current-state sources.
