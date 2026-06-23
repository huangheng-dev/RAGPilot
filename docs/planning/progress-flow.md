# RagPilot Progress Flow

## Purpose

This document is the durable progress map for RagPilot. It shows the intended build order, current status, remaining gaps, and the rule for moving one major technology or feature area to closure before starting the next one.

## Progress Rule

RagPilot should move through the main product chain, not through disconnected technical demos.

Every major capability should close this loop before it is considered complete:

1. product entry point
2. API contract
3. persistence or runtime state
4. governance or operator visibility
5. UI feedback
6. validation path
7. documentation update

Home-page rule:

- `Home` is not a secondary admin console
- it should only expose scope selection plus the three primary operator lanes: `Chats`, `Documents`, and `Workflows`
- supporting diagnostics, governance walls, runtime observability decks, and secondary summaries should stay off the landing surface unless they are required to continue the main chain

Technology work follows the same rule. A runtime or framework is not complete just because it is installed or listed in configuration. It must be visible in a real RagPilot workflow and must remain governed by RagPilot contracts.

## Current Overall Status

Estimated project maturity: `74%`.

Interpretation:

- the local end-to-end knowledge operations path is real
- ingestion, workflow supervision, retrieval, grounded chat, model routing, tool governance, first agent runtime boundaries, native retrieval rerank, and the first answer-feedback loop are now in place
- Phase 4 runtime-governance consolidation is complete across the main operator surfaces
- Phase 5 release hygiene is now underway with repository ignore tightening, contribution rules, and a first CI workflow
- production authentication, deeper evaluation, full MCP management, CI/CD, deployment hardening, and mature agent workflows are still incomplete

## Phase Map

RagPilot should now be tracked in two layers:

- `Phase` is the executive delivery layer
- `Stage` is the implementation detail layer inside each phase

Current phase position:

- `Phase 1` complete
- `Phase 2` mostly complete
- `Phase 3` main chain operational and nearly closed
- `Phase 4` complete
- `Phase 5` in progress

### Phase 1. Foundation and Direction

Status: `complete`

Includes:

- Stage 0. Repository and Local Platform Foundation
- Stage 1. Product Direction and Documentation Control

Outcome:

- the repo, local stack, naming rules, and project blueprint are established
- RagPilot has a durable documentation baseline and implementation direction

### Phase 2. Platform Core and Governance Base

Status: `mostly complete`

Includes:

- Stage 2. Identity, Session, and Access
- Stage 3. Tenant, Workspace, and Knowledge Governance
- Stage 4. Documents and Ingestion

Outcome:

- the platform has directory-backed access, tenant and workspace governance, knowledge-base management, document ingestion, and workflow-backed document operations

Still open:

- production authentication
- fuller authorization coverage and audit depth
- deeper document-processing fidelity and operational controls

### Phase 3. Main Product Chain

Status: `mostly complete`

Includes:

- Stage 5. Retrieval and Grounded Chat
- Stage 6. Workflow Operations

Outcome:

- the primary operator chain is real:

```text
Documents
-> Ingestion
-> Workflows
-> Retrieval
-> Chat
```

- workflow retry, recovery follow-up, retrieval validation, and grounded-chat continuation are now visible through the built product surfaces

Still open:

- stronger retrieval quality evaluation
- richer workflow failure classification and operator guidance
- tighter governance feedback loops from retrieval and workflow outcomes

### Phase 4. Runtime Intelligence and Governance Expansion

Status: `complete`

Acceptance checklist:

- [phase-4-acceptance-checklist.md](F:\RagPilot\docs\planning\phase-4-acceptance-checklist.md)

Includes:

- Stage 7. Model Runtime Governance
- Stage 8. Tool Runtime and MCP Boundary
- Stage 9. Agents
- Stage 10. Admin and Operations Hardening

Outcome so far:

- persisted model, tool, and retrieval governance foundations exist
- agent definitions, bounded runtime lanes, and governance follow-up paths are in place
- admin and settings surfaces now coordinate runtime review instead of acting as isolated registries
- active agent runtime posture now also resolves through one backend governance contract shared by `Agents`, `Admin`, and `Settings`
- `Home` governance summaries and `Operations` recovery-runtime remediation now also consume that same backend contract instead of page-local readiness heuristics
- `Home` governance follow-up now also resolves issue-aware affected-agent queues and concrete MCP connector/tool settings targets, so the landing surface can hand operators directly into the real remediation slice instead of a generic runtime overview
- front-end runtime-governance follow-up in `Home`, `Agents`, `Operations`, and `Admin` is now converging on one shared route-resolution helper, so model, retrieval, tool, and MCP remediation no longer drifts page by page
- the actual `Home` implementation now also removes inactive governance, observability, and capability sections from the landing file itself, so the codebase matches the product rule that `Home` only carries scope plus the three core operator lanes
- runtime governance now also supports backend-owned readiness, issue, and object-scoped filtering by model endpoint, tool registration, and retrieval profile, so governance handoff can stay on one shared affected-definition contract
- `Settings` object-level follow-up for model endpoints, tool registrations, and retrieval profiles now also reads those backend-owned filtered queues before linking into `Agents`, so the settings surface no longer relies on registry-only binding counts when opening remediation slices
- tool governance now also exposes a backend-owned summary contract for native, HTTP, and reserved MCP transport posture, including missing-endpoint and runtime-ready counts, so `Settings` can review tool/MCP boundary health without recomputing registry metrics in the browser
- tool governance now also exposes a backend-owned runtime-audit queue flattened from persisted execution traces, so `Settings` can review recent failed, blocked, reserved, and unavailable tool behavior from one governed contract before full MCP management exists
- tool runtime audit now also classifies persisted traces into governance issues such as approval-required, disabled-tool, reserved-MCP, and endpoint-failure posture, so `Settings` can move directly from observed runtime traces into the correct remediation queue instead of stopping at observability
- `Settings` tool governance now also exposes direct backend-owned governance actions such as enable, disable, require-approval, allow-direct-use, and quarantine, so operators can move from audit review into actual runtime control without manually re-editing the full registration form
- backend-owned `MCP boundary worklist` now also aggregates reserved tool bindings and recent reserved traces for one tenant scope, so `Settings` can review reserved-boundary pressure as a real queue instead of only as transport badges and raw trace fragments
- reserved MCP tools now also move through explicit boundary states (`reviewing`, `quarantined`, `ready_for_integration`) with backend-owned transition actions, so reserved-boundary governance is becoming a managed pre-integration lane instead of a read-only queue
- tool runtime now also distinguishes `reviewing` from `ready_for_integration` for reserved MCP tools, so a cleared governance boundary no longer pretends to be the same runtime state as a still-reserved review boundary when no connector is actually attached
- tool governance summary and registry filtering now also treat `mcp_integration_pending` as a first-class runtime-governance slice, so pending connector attachment can be reviewed directly from `Settings` instead of being reconstructed from runtime traces
- reserved MCP tool governance now also persists a formal `connector_reference`, so pre-integration configuration is no longer trapped in free-text notes and can become the handoff point for the future runtime bridge
- reserved MCP governance now also requires that connector reference before a tool can move into `ready_for_integration`, and `Settings` can review connector-configured reserved tools as a dedicated governance slice instead of inferring readiness from notes
- MCP runtime governance now also includes a first managed connector registry with persisted connector assets, connector-to-tool reference rollups, and reachability preview, so reserved MCP tools no longer depend on free-text connector placeholders alone before runtime bridge work starts
- `Settings` MCP connector governance now also resolves connector-scoped linked tools, affected-agent counts, and direct connector preview results from the same surface, so connector assets are becoming governed runtime objects instead of passive metadata rows
- `Settings` tool and MCP connector editors now also expose their relationship in both directions, so operators can move from a reserved tool into its governed connector and from a connector into its linked tools without reconstructing the runtime bridge by hand
- `Settings` tool and MCP connector detail views now also collapse their runtime follow-up into shared action-packet cards, so boundary audit, connector cleanup, and affected-agent remediation no longer fan out into separate page-local entry patterns
- MCP-related runtime traces in `Agents`, `Operations`, and `Admin` can now also deep-link straight into the governed connector object in `Settings` when a connector reference is known, so runtime remediation can move from broken execution to connector governance without stopping at the broader tool registry
- execution recommended-action specs can now also target governed MCP connector objects by slug, so cross-surface follow-up no longer loses the connector-governance target when an execution stops at `mcp_integration_pending`
- agent runtime governance now also treats `tool_mcp_reserved` and `tool_mcp_integration_pending` as first-class readiness issues, so reserved/pending MCP posture is no longer trapped in tool traces and settings-only review
- recorded execution traces in `Agents`, `Operations`, and `Admin` now also carry that same tool-governance classification and direct follow-up links into `Settings` and filtered affected-agent queues, so runtime failures no longer need page-by-page interpretation before remediation starts
- recent execution cards in `Agents`, `Operations`, and `Admin` now also expose mode-aware next actions into scoped `Chat`, `Documents`, and `Workflows`, so execution review can continue directly into the next operator lane instead of stopping at summary inspection
- agent execution payloads now also persist structured `recommended_action_specs`, so cross-surface follow-up buttons resolve from one backend-owned action contract instead of mixing static summaries with browser-side guesswork
- those structured execution actions now also react to live runtime fallback, tool-governance traces, and retrieval-evidence gaps, so recent execution review can branch into `Settings` governance repair or back into operator lanes from the same backend-owned contract
- grounded-validation follow-up prompts are now also shared across `Home`, `Documents`, uploads, workflow completion, and `Operations -> Chat` handoff, so the core operator loop carries one consistent answer-validation brief instead of page-local draft-question wording
- workspace document and workflow detail sidebars now also keep follow-up cards as state guidance only, while concrete actions stay on the shared execution packet above, so `Documents -> Workflows -> Chat` no longer repeats the same buttons twice inside one inspection panel
- model governance now also exposes a backend-owned summary contract for runtime-ready, missing-base-url, disabled-bound, provider, and credential posture, so `Settings` can review model runtime closure without relying on page-local model counts
- `Settings` model governance now also opens backend-filtered runtime queues for runtime-ready, disabled-bound, missing-base-url, and managed-reserved endpoints, so model remediation can move through the same shared API contract as tool governance instead of browser-local list heuristics
- runtime model binding now also resolves through a governed fallback contract across chat and agent execution, so unavailable configured model endpoints can fall back to a valid default endpoint or service settings with persisted fallback metadata instead of breaking the main execution path

Still open:

- mature agent business workflows
- deeper MCP and tool-governance management beyond the current reserved-boundary state machine
- stronger model runtime health, secret handling, and fallback policy
- lighter, tighter admin and observability surfaces

Closeout note:

- `Home`, `Documents`, `Workflows`, `Operations`, and `Settings` now all follow the reduced main-chain rule, with shared follow-up prompts, shared runtime-governance routing, and reduced duplicate action entry points across the primary operator surfaces

### Phase 5. Release and Production Closure

Status: `in progress`

Acceptance checklist:

- [phase-5-release-checklist.md](F:\RagPilot\docs\planning\phase-5-release-checklist.md)

Includes:

- Stage 11. Public Release Preparation
- remaining production-readiness work across authentication, observability, deployment, and release automation

Outcome target:

- GitHub-ready open-source delivery
- production deployment readiness
- CI/CD, release hygiene, and operational closure

## Main Product Chain

The core product flow is:

```text
Identity
-> Tenant and workspace scope
-> Knowledge base and retrieval posture
-> Document upload
-> Durable ingestion workflow
-> Document and workflow inspection
-> Retrieval validation
-> Grounded chat with citations
-> Agent execution or recovery support
-> Governance review and audit
```

All future work should strengthen this chain.

## Stage Progress

### Stage 0. Repository and Local Platform Foundation

Status: `complete`

Delivered:

- monorepo structure
- Docker Compose local stack
- Next.js web app
- FastAPI API service
- Temporal worker placeholder and ingestion path
- PostgreSQL, pgvector, Redis, MinIO, Elasticsearch, Temporal, and OpenTelemetry local services
- English-first naming and documentation baseline

Remaining:

- production deployment packaging
- CI/CD and release automation

### Stage 1. Product Direction and Documentation Control

Status: `mostly complete`

Delivered:

- project blueprint
- platform blueprint reference
- project snapshot
- technology rollout plan
- local development runbook
- GitHub publish preparation runbook
- lean-core product rule
- final-blueprint implementation rule

Remaining:

- keep roadmap and snapshot updated after each major closure
- add release notes when public GitHub publishing starts

### Stage 2. Identity, Session, and Access

Status: `mostly complete`

Delivered:

- local login surface
- persisted user directory foundations
- tenant membership records
- invitation issuance, activation, revocation, and audit anchors
- session restore against persisted directory state
- local role-aware frontend gates
- first backend actor-header authorization coverage for sensitive write routes
- backend current-user permission snapshot through `GET /api/v1/users/me/permissions`
- protected web routes can now read backend capability values while keeping a transitional local fallback for immediate post-login navigation
- key web actions now read the same backend capability snapshot, including chat message sending, document upload, document reindex/delete/restore, workflow retry, agent definition management, agent execution, admin write access, workspace context resource management, and runtime governance management
- backend write routes for documents, chat, workflow retry, agent definition changes, agent execution, resource governance, and runtime governance now use explicit capability checks instead of route-local role lists
- member-directory routes now also use explicit capabilities for admin-console review, member management, and audit-event review, while preserving self-service access for the current user's own profile and access history
- the current RBAC model keeps capability naming centralized in a shared access policy while route enforcement now prefers database-backed policy grants
- database tables for `roles`, `permissions`, and `role_permissions` now exist with a seeded policy matching the current code-level access policy
- database table support for `user_sessions` now exists as the first backend-managed web session layer
- `/api/v1/users/login` and `/api/v1/users/activate-invitations` now return authenticated session envelopes with server-issued bearer tokens
- request authentication now prefers `Authorization: Bearer <session_token>` and validates that the bound directory user still has active account and membership scope before protected routes continue
- the web auth provider now persists backend-issued session tokens and rehydrates current-user state through authenticated `/users/me` and `/users/me/permissions` reads instead of relying only on browser-local actor headers
- the current authenticated session can now be explicitly revoked through `/api/v1/users/me/sign-out`, and the web console now calls that backend sign-out path before clearing the local session
- `GET /api/v1/users/me/permissions` now prefers the database-backed role policy and falls back to the code-level policy when the policy tables are unavailable or not seeded for the current role
- runtime-governance routes now prefer the database-backed role policy for model endpoint, tool registration, and retrieval profile read, preview, create, update, and delete access
- admin resource governance routes now prefer the database-backed role policy for tenant, workspace, and knowledge-base create, update, lifecycle, and publication actions
- operator routes now prefer the database-backed role policy for chat writes, document writes, workflow retries, agent definition changes, and agent execution
- member-directory routes now prefer the database-backed role policy for admin-console review, member management, and audit-event review, while preserving self-service access for the current user
- document reads, chat history reads, and workflow reads now also use explicit capability checks instead of remaining open during the transition to server-managed sessions

Remaining:

- production authentication
- complete backend authorization coverage for any remaining self-service edge cases
- passwordless or external identity provider path
- stronger access audit reporting

### Stage 3. Tenant, Workspace, and Knowledge Governance

Status: `mostly complete`

Delivered:

- tenant, workspace, and knowledge-base APIs
- lifecycle controls for workspace archive and restore
- knowledge-base publish and draft controls
- admin governance tables and scoped deep links
- retrieval-profile assignment on knowledge bases
- object-level admin governance handoff for workspace, knowledge base, and member objects
- workspace Context Controls now gate tenant, workspace, and knowledge-base create/edit/lifecycle writes through the same current-user permission snapshot used by protected routes

Remaining:

- stronger bulk governance operations
- richer audit trails for resource lifecycle changes
- complete backend permission checks across every management route

### Stage 4. Documents and Ingestion

Status: `mostly complete`

Delivered:

- document upload
- parser support for `TXT`, `Markdown`, `HTML`, `CSV`, `JSON`, `PDF`, `DOCX`, and `XLSX`
- Temporal-backed ingestion
- chunk and embedding persistence
- document detail, version summaries, reindex, soft delete, restore, and batch operations
- document activity timelines and workflow linkage

Remaining:

- deeper parser fidelity for complex files
- richer metadata extraction
- ingestion cancellation and pause controls
- stronger failure classification and repair guidance

### Stage 5. Retrieval and Grounded Chat

Status: `mostly complete`

Delivered:

- hybrid vector and lexical retrieval
- citation-backed grounded chat
- persisted conversations, messages, and citations
- retrieval profiles
- retrieval engine boundary
- `llamaindex_pilot` comparison path
- workspace retrieval validation now feeds back into the grounded-chat entry state, so operators can see pending, ready, review, hold, empty, or failed validation posture before sending the next scoped question
- retrieval validation posture now also feeds into workspace runtime packets, runbooks, and header status, so the whole `Documents -> Operations -> Chat` path can steer toward chat continuation, source review, or governance follow-up from the same live evidence state
- `Home` now also consumes the same retrieval validation posture for its primary route, command packets, retrieval diagnostics entry, and retrieval-status signals, so the platform landing surface follows the same answer-readiness rule as the workspace
- active retrieval-engine visibility in Home, Workspace, Chat, and execution review
- governed model endpoint resolution for chat runtime
- assistant-message feedback persistence with helpful versus review signals
- feedback-aware chat history payloads so answer review stays attached to the persisted assistant message instead of a detached tool panel
- workspace chat now also exposes a compact answer-review queue with recent flagged responses and direct return into the affected conversation thread
- retrieval-review queue items now also carry the original user question back into the workspace validation path, so flagged answers can move straight into another retrieval check instead of stopping at conversation inspection
- flagged answer-review items can now also launch retrieval comparison directly against the original user question, so feedback candidates can move into `native` versus `llamaindex_pilot` evidence review without manual query reconstruction
- retrieval inspect and compare runs can now also persist as scoped evaluation records with recent history in the workspace diagnostics surface, so review work no longer disappears when the current page state resets
- persisted retrieval evaluations now also aggregate into repeated-query tuning candidates with direct inspect, compare, chat, and source-document follow-up, so operator feedback can turn into a real retrieval-adjustment queue instead of a passive history list
- retrieval tuning candidates now also open direct knowledge-base governance and retrieval-profile governance entry points, so diagnostics can move into governed remediation without leaving the main product path

Remaining:

- answer quality evaluation beyond manual operator feedback
- citation quality scoring beyond manual operator feedback
- decision on whether to promote or remove the `llamaindex_pilot` path after quality comparison

### Stage 6. Workflow Operations

Status: `mostly complete`

Delivered:

- workflow list, detail, status filtering, retry filtering, retry, and lineage visibility
- dedicated Operations surface
- queue supervision for queued, running, failed, and retry-derived runs
- document-to-workflow handoff and recovery follow-up
- workflow responses now carry structured recovery guidance for retry-ready, retry-blocked, active-monitoring, and completed-follow-up states
- `Workspace` and `Operations` now both consume the same workflow recovery guidance contract instead of maintaining separate page-local next-step heuristics
- operations-originated audit handoff into agent runs

Remaining:

- workflow cancellation and operator notes
- richer retry policy controls
- deeper execution-step tracing
- production alerting for stuck or failing queues

### Stage 7. Model Runtime Governance

Status: `partial to mostly complete`

Delivered:

- persisted model endpoint registry
- deterministic development runtime
- OpenAI-compatible provider routing
- native `Ollama` provider routing
- governed `vLLM` provider path
- validation preview in Settings
- default model endpoint resolution for chat
- runtime metadata persisted into chat and agent execution outputs
- backend-owned runtime-state model queues for `runtime_ready`, `disabled_bound`, `missing_base_url`, `missing_credential_hint`, and `managed_reserved` review
- governed fallback resolution from configured agent model -> default model endpoint -> service settings, with persisted fallback reason and configured-runtime metadata in chat and agent execution payloads

Remaining:

- secret management
- provider health history
- fallback policy controls
- usage and cost or resource reporting
- production credential delivery

### Stage 8. Tool Runtime and MCP Boundary

Status: `partial`

Delivered:

- persisted tool registration inventory
- native internal tools
- HTTP tool invocation
- approval-gated tool blocking
- approval-filtered tool registry review inside `Settings` for all tools, disabled tools, and approval-required tools
- request and response trace metadata
- reserved MCP transport traces
- backend-owned recent tool runtime audit queue derived from persisted execution traces

Remaining:

- production-grade MCP server management
- tool permission policies
- approval workflow UI
- tool execution audit depth
- transport hardening and timeout policy management

### Stage 9. Agents

Status: `partial`

Delivered:

- top-level Agents destination
- persisted agent definitions
- model endpoint bindings
- tool bindings
- agent launch records
- agent execution records
- readiness and governance issue filters
- bounded `langgraph_pilot` workflow-recovery runtime path
- visible configured-versus-executed runtime engine and fallback posture

Remaining:

- mature agent workflow design
- broader graph execution lanes
- human approval steps
- tool-chain execution policies
- agent result evaluation
- reusable agent templates after the core runtime is stable

### Stage 10. Admin and Operations Hardening

Status: `partial`

Delivered:

- Admin governance surface
- Directory and Access lanes
- runtime governance visibility
- object-level deep links from Home, Agents, Settings, and Operations
- access-event visibility

Remaining:

- reduce duplicate panels and keep only core governance work
- stronger permission enforcement
- richer audit drill-down
- production observability and alert routing

### Stage 11. Public Release Preparation

Status: `partial`

Delivered:

- GitHub publish preparation runbook
- first public release runbook
- local-only ignore rules for runtime output and private notes
- documentation index for public and private documentation placement
- contribution guide for public collaborators
- minimal GitHub Actions CI workflow for web build and API tests
- broader ignore coverage for nested environment files, generated metadata, and private docs folders
- baseline public security-policy file
- GitHub issue and pull-request templates aligned to the RagPilot main product chain
- repository text-normalization baselines through `.editorconfig` and `.gitattributes`
- local Git repository initialization on `main`

Remaining:

- license file
- public repository description
- secret scan before first push
- first tracked baseline commit and remote publish setup
- first tagged release checklist

## Recommended Next Sequence

Use this order for the next major rounds:

1. close production authentication and RBAC foundations enough that protected routes no longer depend on local scaffolding
2. harden document ingestion and workflow operations around failure, retry, and audit follow-up
3. finish retrieval quality closure with evaluation, feedback loops, and pilot comparison
4. deepen model endpoint governance with secret handling and provider health history
5. mature agent execution by expanding one real workflow lane end to end
6. harden MCP and tool management only after the governed tool-runtime path is stable
7. prepare public GitHub release hygiene, CI, and contribution documentation

## Current Priority

The best next product move is:

```text
Access/RBAC hardening
-> Document and workflow recovery depth
-> Retrieval quality evaluation
-> Agent execution closure
-> MCP/tool hardening
-> public release readiness
```

This keeps the project moving through the main chain without turning the platform into a collection of unrelated experiments.
