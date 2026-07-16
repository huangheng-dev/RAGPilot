# RAGPilot Project Snapshot

## Purpose

This document is the current-state authority for RAGPilot. It records what the runnable repository actually delivers without repeating route inventories, database schemas, changelog history, or future task lists.

- Target architecture: `project-blueprint.md`
- Incomplete work: `../planning/roadmap.md`
- HTTP inventory: `../api/api-outline.md`
- Database inventory: `../architecture/platform-data-model.md`

## Product Position

RAGPilot is a governed, multi-tenant knowledge operations platform for source intake, permission-aware retrieval, grounded answers, constrained Agent execution, durable operations, and controlled runtime extension.

The primary operator chain is:

```text
Sign in and resolve tenant scope
-> create or select Workspace and Knowledge Base
-> import a file or single-page URL
-> run durable ingestion and projection
-> inspect or recover workflow state
-> validate retrieval evidence
-> ask a grounded question
-> review citations, feedback, runtime identity, and operational follow-up
```

The product favors explicit scope, durable state, governed runtimes, and reviewable evidence over open-ended autonomy or framework-driven surface expansion.

## Current Application Surfaces

The Web console exposes:

- `Home` — scoped operating posture and next-action routing
- `Chat` — grounded answers, citations, feedback, conversation history, and runtime evidence
- `Documents` — intake, lifecycle, activity, filtering, batch operations, and recovery handoff
- `Operations` — workflow queues, detail, events, notes, retry, cancellation, and lineage
- `Agents` — governed definitions, executions, approvals, evidence, and runtime handoff
- `Admin` — tenant, Workspace, Knowledge Base, member, access, and cross-scope governance
- `Settings` — profile/session security and focused runtime-governance follow-up
- `Workspace` — compatibility route for context-preserving deep links

Authentication-required routes redirect through `/login` and return to the originally requested location. Tenant, Workspace, Knowledge Base, selected-resource, query, and governance state are preserved in URLs where operational handoff requires it.

## Current Platform Capabilities

### Identity and access

- backend-issued User sessions with password-local and external-provider contract boundaries
- first-admin bootstrap followed by governed User creation and invitation activation
- password change/reset, session inventory, targeted/bulk revocation, and security summaries
- multi-tenant membership lifecycle and access-event audit history
- database-policy-first RBAC with named capability enforcement in API and Web actions
- tenant Access Groups plus user/group grants for restricted Documents and Chunks, enforced inside PostgreSQL retrieval queries and managed through audited admin contracts
- tenant-scoped platform API keys with one-time secret display, hash-only storage, scopes, expiry, revocation, last-use tracking, and lifecycle audit events

Legacy actor headers exist only as a transitional compatibility path and are disabled by production defaults.

### Knowledge and ingestion

- persisted Tenant, Workspace, Knowledge Base, publication, and lifecycle management
- durable Data Source identity for file and URL intake
- document binding, item-level external identity/version state, synchronization lease/status/cursor, synchronization-run history, and legacy backfill
- versioned connector SPI with an active `public_web_v1` adapter for SSRF-guarded, conditional single-page synchronization
- Temporal-owned source synchronization that skips unchanged content, creates immutable versions for changes, projects authoritative deletions, and prevents concurrent runs with database leases
- file ingestion for supported text, structured-data, PDF, DOCX, XLSX, PNG, JPEG, WebP, TIFF, and BMP formats
- governed OCR fallback for scanned PDFs and direct OCR for standalone images with bounded pixel safety
- single-page URL import through the normal workflow-backed ingestion chain
- version, asset, Chunk, embedding, activity, soft-delete, restore, permanent-delete, and reindex lifecycle
- Temporal-backed ingestion and Data Source synchronization plus Outbox-driven Elasticsearch projection and reconciliation

PostgreSQL remains the business source of truth. pgvector and Elasticsearch are query/index projections that can be rebuilt from persisted source records.

### Retrieval and grounded Chat

- pgvector semantic recall and Elasticsearch BM25/filter recall with PostgreSQL lexical fallback
- governed fusion, native reranking, retrieval profiles, effective-profile resolution, and diagnostics
- optional `llamaindex_pilot` comparison behind the retrieval-engine boundary
- persisted retrieval evaluation records, summaries, and operator follow-up queues
- versioned contract datasets with ranking, latency, groundedness, citation, isolation, and cost gates in CI and release preflight
- grounded conversations, Messages, Citations, feedback, history, search, metrics, rename, and deletion
- provider-native SSE Chat deltas for Ollama and OpenAI-compatible runtimes, explicit completion-chunk fallback, disconnect cancellation, and persisted final Messages

Streaming mode is persisted in Message usage evidence as `provider_native` or `completion_chunked_fallback`, so operators can distinguish real provider deltas from compatibility behavior.

### Model and Prompt governance

- deterministic, OpenAI-compatible, native Ollama, and governed vLLM-compatible model paths
- model endpoint creation, preview, capability/readiness posture, health history, governance actions, and deletion
- encrypted runtime credentials with explicit rotation events
- timeout, retry, fallback, usage/cost evidence, and Redis-backed cross-instance concurrency/request-rate controls
- versioned Prompt Templates and Prompt Versions
- immutable Prompt version and content-hash binding on Messages, Agent Runs, and Agent Executions

The `packages/prompts` package remains the authored-asset/import-export boundary; the active runtime catalog is persisted in PostgreSQL.

### Tools, MCP, and Agents

- governed native and HTTP Tool registrations with preview, policy, approval, retry, response limits, and audit traces
- governed Streamable HTTP MCP connector registration, discovery, compatibility checks, credential rotation, remote Tool mapping, preview, and Agent invocation
- MCP JSON-RPC cancellation notification when an in-flight remote request is cancelled
- Redis-backed cross-instance MCP concurrency/request-rate control
- standalone `stdio` MCP server with API-key-scoped knowledge search, document inspection, and workflow inspection tools
- persisted Agent definitions, launches, durable executions, evaluation summaries, retry/cancel/replay lineage, replay fingerprints, and human approval decisions
- immutable per-execution definition and allowed-Tool sandbox snapshots, deployment-capped tool/runtime/output budgets, and optional JSON Schema result validation
- optional bounded `langgraph_pilot` lanes inside Temporal-owned durable execution

The standalone `apps/mcp-server` package is an active read-only outbound-server boundary. It remains separate from the MCP client/control-plane path and is not a top-level product destination.

### Workflows and operations

- Temporal-backed ingestion and Agent execution
- durable Workflow Runs, Steps, Events, notes, retries, cancellation, and subject lineage
- tenant-scoped queue metrics and recovery views
- search-projection queue depth, lag, failure, stale-version, and active-index diagnostics
- operator handoff among Documents, Operations, Chat, Agents, Admin, and focused Settings objects

### Observability and delivery

- inbound W3C Trace Context extraction and correlated response `traceparent`
- propagation across API, Temporal, Worker, retrieval, model, Tool, MCP, embedding, and Elasticsearch boundaries
- privacy-safe structured JSON logs with trace/span identity and OTLP log export
- bounded metrics and spans for latency, errors, queue state, retries, usage, fallback, projection, Agent, and Tool behavior
- Collector, Prometheus, Tempo, Grafana, dashboards, alert baselines, and operator reliability runbook
- health-gated Docker dependency stack, stable host-managed API/Web mode, Kubernetes baseline, and release preflight
- API, Worker, Web build, MCP build/protocol tests, versioned retrieval gate, and authenticated browser E2E validation

## Technology Boundaries

- PostgreSQL owns business truth and durable governance state.
- pgvector owns semantic recall; Elasticsearch owns rebuildable lexical/search projection.
- Temporal owns durable retries, timers, cancellation, waiting, and workflow history.
- LangGraph, when selected, owns bounded in-run graph transitions rather than durable business workflow ownership.
- LlamaIndex remains an optional retrieval adapter rather than the platform foundation.
- Model-provider behavior stays behind the model gateway.
- MCP and HTTP Tools remain explicitly registered, tenant-scoped, policy-checked, and auditable.
- Browser pages consume backend-owned policy and governance contracts instead of recreating them locally.

## Deliberate Incomplete Boundaries

The active Roadmap owns details. The important current boundaries are:

- production selection and closure of the deployed identity-provider mode
- optional legacy MCP SSE compatibility
- complex-layout/table OCR and deeper structure-preserving parsing
- larger production-like evaluation datasets and provider-neutral reranking promotion
- deployment-specific backup/restore, capacity, telemetry retention, and incident exercises
- broader LangGraph lanes only when branching, checkpointing, approval, and output validation justify them

These are explicit boundaries, not evidence that the core product path is missing.

## Maintenance Rule

Update this file only when verified product behavior changes. Do not append implementation chronology or page-by-page micro-features. Detailed changes belong in `CHANGELOG.md`; unfinished work belongs in the Roadmap.

## Primary References

- [Project Blueprint](./project-blueprint.md)
- [Roadmap](../planning/roadmap.md)
- [System Overview](../architecture/system-overview.md)
- [Platform Data Model](../architecture/platform-data-model.md)
- [API Outline](../api/api-outline.md)
- [Local Development Runbook](../runbooks/local-development.md)
- [Production Reliability Runbook](../runbooks/production-reliability.md)
