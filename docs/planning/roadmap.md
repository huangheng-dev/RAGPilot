# RAGPilot Roadmap

## Purpose

This roadmap records prioritized evolution beyond the verified [Project Snapshot](../product/project-snapshot.md). It is not a second capability inventory, release history, or claim that every listed direction is required by every deployment.

Durable target boundaries belong in the [Project Blueprint](../product/project-blueprint.md). An evolution item is reflected in the Snapshot only after its runtime behavior, persistence, authorization, governance, tests, deployment configuration, and diagnostics agree where applicable.

## Verified Baseline

The current platform already closes its primary operating loop: governed source intake, durable ingestion, permission-aware hybrid retrieval, grounded Chat, constrained Agent execution, operational recovery, observability, and release validation. Exact implementation status remains owned by the [Project Snapshot](../product/project-snapshot.md).

The tracks below extend depth, integration coverage, and deployment confidence; they do not redefine the existing core.

## Deployment Qualification

Production qualification is completed against the environment that will actually carry traffic. These activities are deployment responsibilities because identity providers, managed services, retention requirements, capacity, and recovery objectives differ by operator.

### Identity and credential operations

- select and validate the deployed authentication mode: governed local password or an external identity provider
- complete callback, logout, claim mapping, and session-revocation operations when an external provider is selected
- expose API-key administration in a product surface only when operators require browser-based management
- define ownership, rotation, and emergency revocation policy for platform, model, MCP, and infrastructure credentials

### Reliability validation

- validate backup and restore for PostgreSQL, object storage, Elasticsearch projections, and required Secrets
- define telemetry retention, sampling, alert routing, incident ownership, and escalation policy
- exercise capacity limits, dependency failure, recovery-time objectives, and disaster recovery
- keep Kubernetes or managed-service overlays aligned with the verified runtime contract

## Engineering Evolution

### P1 — Retrieval and document depth

- expand versioned evaluations with representative production-like queries, adversarial isolation cases, and larger regression baselines
- promote provider-neutral reranking only when it outperforms the deterministic fallback without weakening isolation, latency, cost, or recoverability
- deepen OCR and DOCX/XLSX structure extraction for complex layouts and tables where product demand justifies the maintenance cost
- add multi-item connector adapters only for proven workflows; every adapter must preserve lease, cursor, idempotency, network-safety, and authoritative-snapshot contracts

### P1 — Runtime interoperability

- add legacy MCP SSE compatibility only when a supported integration requires it
- expand LangGraph beyond bounded lanes only when branching, checkpointing, approval, and output validation are observable and testable

### P2 — Governance experience

- expose Prompt comparison, activation, rollback, and import/export when operators need authored-asset management in product surfaces
- deepen API-key, credential, model, MCP, Data Source, and evaluation audit views without duplicating backend policy in the browser
- keep resource ownership, reason, actor, and lifecycle evidence queryable through tenant-safe contracts

## Deliberate Non-Goals

- replacing PostgreSQL as the business source of truth
- making LlamaIndex or LangGraph mandatory platform foundations
- exposing unrestricted MCP or HTTP Tools to Agents
- adding framework names without a closed product path
- adding dashboards, control panels, or orchestration surfaces that do not close an operator workflow

## Update Rule

For every material closure:

1. update the Snapshot with verified behavior;
2. remove or narrow the corresponding roadmap item;
3. update the API, data-model, architecture, and runbook documents that own the affected contract;
4. remove superseded planning material after its durable conclusions are consolidated.
