# Changelog

All notable changes to RAGPilot will be documented in this file.

The format follows a Keep a Changelog style with SemVer-style release tags.

## [Unreleased]

### Added

- Redis-backed cross-instance model and MCP concurrency/rate limits with configurable failure behavior
- privacy-safe JSON logs, OTLP log export, inbound trace extraction, and outbound W3C Trace Context propagation
- versioned retrieval datasets with deterministic CI/release promotion gates
- persisted Prompt templates and versions bound to chat messages and Agent runs through snapshot hashes
- tenant-scoped platform API keys with hashed secrets, scopes, expiry, revocation, usage tracking, and lifecycle audit events
- SSE chat transport with incremental web rendering and persisted completion records
- durable Data Source identity, document binding, synchronization state, cursor, and run history with legacy backfill
- versioned public-web connector SPI with SSRF-safe conditional fetch, database sync leases, Temporal orchestration, incremental document versioning, deletion projection, and Documents-surface controls
- tenant access groups and user/group grants enforced at document and Chunk retrieval boundaries, with audited management APIs and Web controls
- production delivery baseline with Kubernetes manifests, a production environment template, and a dedicated delivery audit
- responsive operator layouts across home, chat, documents, agents, operations, administration, and settings
- knowledge-scope selection for chat and document intake across workspaces and knowledge bases
- governed runtime resource management for model endpoints, tools, connectors, and retrieval profiles
- conversational intent routing for lightweight greetings without unnecessary knowledge retrieval
- authenticated browser acceptance coverage for the primary product surfaces
- governed read-only `stdio` MCP server tools for tenant-safe knowledge search, document inspection, and workflow inspection
- provider-native Chat streaming for Ollama and OpenAI-compatible runtimes with safe completion-chunk fallback and disconnect cancellation
- governed standalone-image OCR for PNG, JPEG, WebP, TIFF, and BMP assets
- retrieval regression cases for knowledge-base isolation, deleted/stale content, retrieval injection, and multilingual OCR
- governed Agent execution budgets, immutable definition/tool sandbox snapshots, JSON Schema result validation, replay fingerprints, and auditable terminal-run replay
- Compose health-gated startup for PostgreSQL, Redis, Temporal, API, and dependent runtime workers
- an authorized LlamaIndex comparison lane with official similarity/long-context processors, final PostgreSQL reauthorization, and processor evidence
- typed LangGraph decision lanes for document intake and workflow recovery with branch-specific plans, validation, node timing, and operator-visible traces
- persisted, versioned framework policies on Retrieval Profiles and Agent definitions, immutable execution binding, and deployment-readiness governance for missing optional adapters
- release-blocking Native/LlamaIndex quality comparisons and Native/LangGraph branch, validation, trace, fallback, and steady-state overhead contracts
- multilingual, Chinese OCR, long-context, ACL, stale/deleted lifecycle, and adversarial cross-scope retrieval regression cases
- manifest-verified PostgreSQL and MinIO backup/restore drills with isolated resources, exact schema/version checks, fault-injection recovery assertions, and guaranteed cleanup
- exact uv resolutions and exported container dependency locks with automated drift enforcement
- pull-request release-profile image builds and multi-architecture GHCR publication with SBOMs, provenance attestations, and keyless Cosign signatures
- versioned staging capacity gates for liveness, database readiness, and authenticated retrieval without recording request or response secrets
- a protected, manually dispatched staging-capacity workflow with environment-scoped inputs and sanitized evidence retention

### Changed

- public host-port defaults now follow each component's conventional port; Web uses `3000`, Grafana uses the conflict-free adjacent port `3001`, and environment-variable overrides remain available
- public README documentation now separates verified architecture characteristics, integration status, version scope, deployment responsibilities, and engineering evolution without generalized competitor comparisons
- web container delivery now runs a production Next.js server instead of a development server
- local API test execution now falls back cleanly between the project virtual environment and the active Python runtime
- release preflight now includes a production delivery audit alongside docs, links, candidate-set, and secret checks
- chat conversation management now provides searchable, paged history with explicit rename and deletion actions
- document intake supports multi-file upload and web-page import within an explicit knowledge-base scope
- document, agent, chat diagnostic, and administration dialogs share a consistent responsive form and action layout
- administration, operations, and settings use aligned navigation, spacing, filters, summaries, and detail surfaces
- model request handling uses a production-oriented timeout window and explicit unavailable or timeout responses
- English and Simplified Chinese product copy is aligned across the updated operator workflows
- retrieval and Agent runtime defaults are consistently `native` across application, Compose, Kubernetes, and environment templates; installed framework adapters require explicit activation
- optional framework dependencies are split into core API, Agent Worker, and full development/evaluation build profiles instead of being mandatory container dependencies
- Chinese documentation navigation uses translated labels while clearly identifying English technical and governance bodies as the current canonical source
- production ingestion and retrieval embedding identities are aligned, full framework image capabilities stay consistent across API and Agent Worker, and health dependency probes are bounded independently from retrieval timeouts
- container base images are digest-pinned and Kubernetes workloads use bounded rollout history, topology spreading, disabled automatic service-account credentials, and stricter probe/termination behavior
- direct PostCSS build tooling is updated to the patched line; the separate version bundled exactly by Next.js remains governed as a temporary upstream risk instead of being hidden by an unsupported lockfile override or destructive framework downgrade
- Platform API Key usage telemetry is write-throttled per process to prevent concurrent requests from serializing on a shared audit row
- the staging capacity corpus now validates every configured path against the actual FastAPI router, correcting the authenticated retrieval path before environment promotion
- release qualification now supports detached pull-request checkouts and runs Alembic from an explicit, location-independent project configuration

### Security

- login surfaces no longer expose or prefill example account email addresses
- production documentation explicitly requires environment-owned identities, secrets, and runtime credentials

## [0.1.0] - 2026-06-25

### Added

- grounded chat with citations and persisted conversation history
- governed document ingestion, workflow retry, cancellation, and lineage visibility
- runtime governance for model endpoints, tool registrations, retrieval profiles, and MCP connector boundaries
- agent runtime handoff across `Home`, `Chat`, `Documents`, `Agents`, `Admin`, `Operations`, and `Settings`
- English-first repository conventions with Simplified Chinese operator support

### Established

- root-level public documentation for product, contribution, security, and release history
- release validation scripts for documentation audit, link audit, candidate audit, and secret scanning
- a public repository baseline aligned to the core knowledge, retrieval, workflow, agent, and governance architecture
