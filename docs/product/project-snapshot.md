# RagPilot Project Snapshot

## Purpose

This document is the fastest whole-project overview for contributors who need to understand RagPilot without reading every design document first.

## Product Identity

RagPilot is an English-first, open-source, production-oriented AI knowledge platform.

It is being built as:

- a knowledge operations platform
- a RAG application foundation
- a retrieval-grounded chat system with citations
- a workflow-driven document ingestion and indexing platform

It is not being built as:

- a consumer chat toy
- a landing-page demo
- a single-model wrapper
- a clone of any legacy PHP project

## Current Positioning

RagPilot is currently in an operations-first stage.

The implementation focus is on:

- administrator console foundations
- tenant, workspace, and knowledge base management
- document ingestion and document operations
- workflow visibility and retryability
- grounded chat with citations
- lifecycle management for managed resources

Implementation discipline:

- core flows should now be pushed toward the final product blueprint
- temporary local implementation shortcuts may exist, but they should be treated as transitional only
- current shortcuts must not redefine the long-term product architecture
- future technology rollouts should now be delivered one technology at a time, with each selected runtime or framework taken through a visible product closure before the next technology starts
- technology rollout must stay attached to the main product chain instead of becoming isolated technical demos
- every technology introduced into RagPilot should strengthen a real operator path such as directory access, document intake, retrieval validation, grounded answer generation, workflow recovery, governance follow-up, or agent execution review
- a technology is not considered complete when it only exists in infrastructure or diagnostics; it should close the product loop through runtime, persistence, governance visibility, UI visibility, and operator follow-up
- project documentation should name only technologies that are implemented, actively piloted, or explicitly approved in the rollout plan
- unapproved framework names must not be added to stack lists, roadmap items, UI labels, or progress reports

## Current Product Constraint

RagPilot is now explicitly following a lean-core product constraint.

That means:

- the project should stay focused on core knowledge operations instead of expanding into broad, layered control surfaces
- visible pages should be reduced to the minimum set needed for real work
- duplicate summaries, secondary dashboards, and concept-heavy UI wrappers should be removed or folded back into the main task surfaces
- future implementation rounds should prefer simplification over expansion unless a new feature closes a real core workflow gap

The current intended visible core is:

- `Home`
- `Chat`
- `Documents`
- `Operations`
- `Admin`
- `Agents` in a reduced, task-focused form
- `Settings` in a lightweight support role

Current visible-surface interpretation:

- `Home` should stay focused on scope plus the three core product lanes: `Chats`, `Documents`, and `Workflows`
- `Operations` should prioritize workflow queues, retry actions, selected run focus, and run detail instead of secondary runtime observability walls
- `Admin` should prioritize resource governance, member governance, and activation handling instead of broad summary walls or duplicate observability decks
- `Agents` should stay focused on definition, readiness, execution, and launch handoff rather than extended architecture or governance exposition

Reserved, compatibility, or deferred areas must not drive the main product shape.

## Current Repository Structure

```text
RagPilot/
  apps/
    api/
    mcp-server/
    web/
    worker/
  docs/
    api/
    architecture/
    planning/
    product/
    runbooks/
    templates/
  infra/
    docker/
    k8s/
    otel/
  packages/
    evals/
    prompts/
    shared-types/
```

## Current Technology Stack

### Frontend

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui component structure built on Radix UI primitives

### Backend

- FastAPI
- Python 3.10
- Pydantic
- SQLAlchemy 2
- asyncpg

### Background workflows

- Temporal
- Python worker runtime

### Data and storage

- PostgreSQL
- pgvector
- Redis
- MinIO
- Elasticsearch

### Observability and local infrastructure

- OpenTelemetry
- Docker Compose

## Technology Direction

RagPilot currently keeps its core platform architecture self-managed and does not depend on a mandatory external orchestration framework for retrieval or agent execution.

Current implementation baseline:

- `Next.js`
- `FastAPI`
- `Temporal`
- `PostgreSQL`
- `pgvector`
- `Elasticsearch`
- `Redis`
- `MinIO`
- `OpenTelemetry`
- governed chat-model runtime resolution with deterministic, OpenAI-compatible, and native `Ollama` adapters
- persisted default model endpoints now drive general grounded chat when no agent-specific runtime binding is attached
- API health now reports the effective default chat runtime after model-endpoint resolution, so a governed `Ollama` or `vLLM` default endpoint is visible as the actual active runtime instead of only as raw settings fallback

Reserved future evaluation:

- `LlamaIndex` as an optional retrieval enhancement layer, now with a minimal pilot adapter path behind `llamaindex_pilot`
- `LangGraph` as an optional future agent-runtime orchestration layer, now with a bounded `workflow_recovery` pilot behind `agent_runtime_engine=langgraph_pilot`
- `vLLM` as an optional private-inference runtime, now with a governed provider path through the model-endpoint gateway

These items should be treated as future integration candidates, not current required dependencies.
The phased rollout sequence is tracked in [technology-rollout.md](./technology-rollout.md), with the retrieval-engine boundary already implemented as Phase 1.
The retrieval comparison path is now also live through `POST /api/v1/retrieve/compare`, which lets RagPilot compare `native` and `llamaindex_pilot` results on the same grounded question before any deeper retrieval rewrite is approved.
The single-run retrieval path through `POST /api/v1/retrieve` now also returns the active `engine_name`, so the normal retrieval surface and the compare surface expose the same engine identity.
The retrieval evaluation path now also includes persisted summary aggregation, so repeated review, hold, failed, or empty queries can surface as direct tuning candidates inside the operator workflow instead of remaining buried in raw history rows.
The agent runtime now also has an explicit engine boundary with `native` as the default implementation and `langgraph_pilot` as the import-safe optional adapter path.
When `langgraph_pilot` is configured, RagPilot now also records the actual executed runtime separately from the configured runtime, so bounded native fallback for unsupported lanes is visible instead of being misreported as a graph execution.
The current progress chain is tracked in [Progress Flow](../planning/progress-flow.md), which should be updated whenever a major stage moves from partial to mostly complete or complete.

## Current Runtime Observability Baseline

RagPilot now persists lightweight agent-launch telemetry through `agent_runs`.

The current baseline includes:

- persisted launch records for runtime handoff out of `Agents`
- multi-entry launch recording from `Home`, `Admin`, `Workspace`, and `Operations`
- filtered query support by tenant, agent definition, target surface, trigger source, and run status
- runtime volume snapshots in `Home`, `Admin`, `Agents`, and `Operations`

This is still launch telemetry, not a full future agent-execution engine.

RagPilot now also persists task-state execution history through `agent_executions`.

The current execution baseline includes:

- queued, running, completed, and failed execution states for selected agent definitions
- execution-task history and execution-state metrics in the `Agents` console
- workflow-recovery execution visibility inside `Operations`
- deterministic operational summaries for document-intake and workflow-recovery lanes
- governed runtime binding resolution for agent-linked chat models
- grounded-chat execution previews that now move through retrieval plus the resolved runtime adapter instead of summary generation alone
- explicit `agent_runtime_engine` selection with `native` active by default and `langgraph_pilot` available as the first optional orchestration boundary
- bounded `LangGraph` workflow-recovery execution traces that keep graph orchestration visible without expanding the pilot into every agent lane at once
- recorded `LangGraph` pilot step traces are now readable in both `Agents` and `Operations`, so the bounded graph path is visible from execution review instead of hidden in backend payloads
- grounded execution payloads now also persist both configured and executed agent-runtime engine identity, plus explicit fallback posture when `langgraph_pilot` resolves back to native outside the supported lane
- API health visibility for whether the optional `LlamaIndex` and `LangGraph` pilot dependencies are actually installed and loadable in the running environment
- first-pass tool-runtime execution with native internal capabilities, approval-gated tool blocking, live HTTP transport invocation, transient-upstream retry handling, request/response trace metadata, reserved MCP transport traces, and visible preview or execution traces in the web console
- live model-endpoint validation previews in `Settings`, including provider response excerpts and runtime metadata for deterministic, OpenAI-compatible, and native `Ollama` chat endpoints
- grounded chat message history now surfaces runtime binding metadata, including provider, runtime source, endpoint name, and base URL when a governed `Ollama` or `vLLM` endpoint is the active chat runtime
- grounded chat and grounded agent-execution payloads now also persist the resolved `retrieval_engine`, so `native` versus `llamaindex_pilot` can be reviewed from real answer history instead of only from diagnostics utilities

## Current Application Areas

### Web console

The current web application includes:

- `Home` overview page
- `Workspace` operator page
- `Admin` governance page

The current workspace surface includes:

- grounded chat with citations
- grounded chat citations with retrieval-method and score-breakdown diagnostics
- hybrid retrieval-backed grounded chat with vector and lexical result fusion
- CJK-aware lexical retrieval expansion for Chinese queries, plus stronger exact-title and exact-phrase lexical scoring
- low-signal vector-only rows now drop behind lexical evidence during hybrid retrieval when lexical matches exist
- citation-to-document navigation with document-version-aware source inspection
- conversation history
- explicit conversation creation and title management
- conversation deletion with persisted cleanup of messages and citations
- cleaner auto-generated titles for newly created chat threads
- workspace-scoped conversation activity metrics and current-thread message counters
- conversation search and recent-activity-first ordering inside the workspace surface
- conversation list summary fields for message counts and latest activity timestamps
- URL-driven conversation search persistence for workspace chat deep links
- assistant messages now surface the resolved runtime model and provider metadata from persisted runtime bindings
- assistant messages now also surface the persisted retrieval-engine identity from real grounded answers
- assistant messages now also persist operator answer feedback, so helpful versus review-needed decisions stay attached to the exact grounded response
- workspace chat now also includes a compact answer-review queue for recent flagged responses, with direct return into the affected conversation thread
- flagged answer-review items now also carry the original user question back into retrieval validation, so operators can re-check evidence without rebuilding the prompt manually
- the same flagged answer-review items can now also trigger direct retrieval comparison on the original question, so `native` versus `llamaindex_pilot` review can start from a real failed answer instead of a synthetic diagnostics-only prompt
- workspace retrieval diagnostics now also persist recent inspect and compare runs as scoped evaluation records, so the current operator path can accumulate retrieval-review history before a larger evaluation center exists
- document ingestion support for `TXT`, `Markdown`, `HTML`, `CSV`, `JSON`, `PDF`, `DOCX`, and `XLSX`
- documents view
- workflows view
- tenant, workspace, and knowledge base switching
- create and edit flows for managed resources
- workspace archive lifecycle
- knowledge base publication lifecycle
- document search, sort, filtering, and pagination
- document lifecycle filtering across active, deleted, and all records
- soft-deleted documents can now be inspected and restored without leaving the documents surface
- batch document reindex and batch soft delete with result summaries
- batch restore is now available for deleted document selections
- document action follow-up prompts that route operators into failed document review or workflow supervision
- selected failed documents with direct recovery actions into failed queue review and workflow supervision
- document activity timelines with backend-aggregated version and workflow events
- workflow search, status filtering, and workflow type filtering
- workflow retry-mode filtering and operations-oriented queue shortcuts
- workflow supervision shortcuts for failed runs, priority execution queues, and return-to-documents navigation
- default workspace operator-flow packets and runbooks that keep intake, supervision, and grounded validation aligned even without an incoming handoff
- automatic upload follow-up that focuses the new document or workflow run and routes the operator into either validation or recovery based on live workflow outcome
- dynamic home-route prioritization that opens recovery, monitoring, intake, or grounded validation from the current scoped platform state
- home command-center packets now follow the same canonical `Documents -> Operations -> Chat` operator chain, so intake, monitoring, recovery, and validation entry points stay consistent across the landing surface
- stronger workspace empty-state and healthy-state continuation actions across chat, documents, and workflows so the operator path stays explicit between pages
- selected document and workflow detail panels with explicit ready, in-progress, and recovery follow-up actions so state inspection and next-step execution stay on the same surface
- state-aware workspace lane switching that now carries validation or recovery intent across chat, documents, and workflows, instead of treating surface changes as neutral tab changes
- grounded-chat return prompts now respect real document and workflow readiness, so queued reindex runs no longer masquerade as validation-ready chat context
- document action summaries now keep operators on the correct next lane by distinguishing between workflow monitoring, failed-document recovery, and grounded validation follow-up
- grounded chat now recovers citation quality when canonical source documents are restored back into the active knowledge-base scope
- operations runtime task packets now also distinguish failed recovery, active monitoring, intake return, and validation return when no concrete run is selected yet, so the operations control surface can keep the main loop moving from aggregate queue posture alone
- document upload follow-up now stays visible as a first-class documents-surface card instead of disappearing into a transient toast-style status message
- home recent-activity cards now also route by live readiness and failure state, so recent documents, workflows, and execution records reopen the most useful next surface for the operator
- richer workflow metrics for queued, running, and retry-derived execution volume
- workflow retry and workflow detail inspection
- URL-driven entry into chat, document, and workflow views with initial target selection
- URL persistence for conversation selection plus document and workflow sort, filter, and pagination state

The current admin surface includes:

- a clearer governance split between `Overview`, `Directory`, and `Access`
- tenant scope selection
- workspace lifecycle filtering
- knowledge base publication filtering
- direct workspace archive and restore actions from governance tables
- direct knowledge base publish and draft actions from governance tables
- cross-resource search
- result counts for workspace and knowledge base governance lists
- tenant-scoped conversation activity metrics for governance review
- tenant chat activity ranking with direct workspace chat entry
- chat signals for the most active tenant, stale tenant chat scope, and idle conversation scope
- direct operator links from governance chat signals into workspace chat scope
- scoped primary-route shortcuts into workspace chat, document, and workflow surfaces
- scoped failed-document and failed-workflow shortcuts from governance scope
- tenant activity cards with direct links into documents and governance
- direct links from governance tables into workspace chat, document, and workflow surfaces
- URL-driven tenant and lifecycle filters that preserve governance scope in navigation
- persisted agent governance inventory with tenant, mode, status, scope, and operations handoff visibility
- governance watch items that now cover agent scope readiness in addition to workspace and knowledge-base controls
- governance-scoped agent runtime observability with tenant runtime breakdown and recent recorded launches
- governance-scoped execution-task observability with cross-tenant counts, recent execution traces, and bound-tool trace visibility
- governance-scoped workflow pressure observability with cross-tenant failed, queued, running, and retry execution signals
- governance-scoped document pressure observability with cross-tenant failed, active-intake, completed, and total document signals
- governance-scoped runtime-governance posture with active-agent attention counts plus disabled model and tool binding visibility
- knowledge-base governance visibility for effective retrieval profile assignment and platform-default fallback posture
- retrieval-profile filtering inside knowledge-base governance so admin review can isolate a single governed retrieval posture
- retrieval-profile governance cards in `Admin` overview so each profile can be reviewed through scoped bindings, fallback coverage, and direct governance follow-up
- home-scoped runtime-governance posture with direct entry into attention agents, settings, and admin governance follow-up
- home-scoped execution-task observability with recent tenant executions and bound-tool trace visibility
- recent execution cards across `Home`, `Agents`, `Admin`, and `Operations` now also surface grounded evidence-source summaries and retrieval-method mix, instead of only status and summary text
- agent readiness now also includes retrieval-governance validation for scoped knowledge bases, including missing effective retrieval posture and disabled assigned retrieval profiles
- home, admin, and settings runtime-governance actions now also route directly into retrieval-specific agent attention queues
- the `Agents` control layer now also includes retrieval-governance execution packets and release-board review actions, so retrieval remediation can be opened directly from the same top-level decision surface as runtime and governance follow-up
- `Admin` runtime handoff review now also distinguishes retrieval-missing and retrieval-disabled routes before launch, instead of treating scope resolution alone as sufficient runtime readiness
- retrieval-governance follow-up can now open `Settings` with a focused retrieval-profile selection in place, so registry remediation can land directly on the governed object instead of a generic runtime-governance list
- retrieval-governance pressure visibility in `Admin`, including disabled bound retrieval profiles, explicit profile assignment, disabled-profile assignments, and platform-default fallback usage
- retrieval-governance watchlist coverage in `Admin`, so the same governance queue now flags disabled-profile assignments and default-fallback knowledge bases
- object-level admin governance deep links for knowledge bases, so `Admin` can open directly into the affected knowledge-base edit dialog when a runtime or retrieval issue already knows the target object
- retrieval remediation handoff from `Agents` and `Admin` now prefers the concrete scoped knowledge base when available, instead of stopping at a generic directory filter
- object-level admin governance deep links now also cover workspaces and members, so directory and access-control follow-up can open directly into the affected workspace or member edit surface
- recent access audit entries and current-actor security posture can now hand off directly into member governance, keeping access review tied to the persisted directory object instead of a detached audit trail
- `Operations` governance follow-up now prefers the concrete scoped workspace when runtime recovery already knows the workspace boundary, so remediation can move straight into workspace governance instead of starting over from admin overview
- `Operations` governance follow-up now prefers the concrete scoped knowledge base before the broader workspace fallback, so recovery can land on the exact governed knowledge asset when the workflow subject already resolved that boundary
- member-governance follow-up in `Admin` now also prefers concrete member objects from invitation queues and security pressure cards, so invited, expiring, expired, dormant, and suspended states can be opened directly instead of only filtered at the list level
- `Home` now prefers the current scoped knowledge base or workspace for admin handoff entry points, so the platform landing page can move directly into the active governed object instead of always reopening generic admin overview
- `Settings` retrieval-profile editing now links into the affected admin knowledge-base inventory when the selected profile is already bound, so retrieval tuning and knowledge-asset governance can be handled as one continuous path
- `Admin Access` now exposes a dedicated pending-activation queue with direct invitation issue, activation, revoke, and member-governance follow-up, so invited members can be processed as an explicit operational queue instead of only inferred from summary metrics
- `Settings` now also supports focused model-endpoint and tool-registration deep links in addition to retrieval-profile focus, so runtime remediation can land directly on the governed runtime object instead of reopening a generic registry view
- `Home` runtime-governance actions now prefer the first affected disabled model, disabled tool, disabled retrieval profile, or approval-gated tool before falling back to generic settings, so the overview surface can hand operators into the concrete runtime asset that needs intervention
- `Admin` runtime-governance actions now follow the same focused settings-object pattern as `Home`, so cross-tenant governance review can move from posture signals into a concrete model, tool, or retrieval asset without another search pass
- `Agents` now also accepts concrete model-endpoint and tool-registration filters through URL state, so registry and runtime-governance follow-up can isolate the exact affected agent set rather than only a broad readiness lane
- `Settings` model and tool surfaces now expose direct affected-agent follow-up, including disabled-runtime queues scoped to the selected model or tool object, so registry remediation can continue into the live operator backlog without manual re-filtering
- `Operations` now also inspects the focused recovery agent for disabled model, disabled tool, and disabled retrieval posture before opening governance follow-up, so recovery supervision can pivot into the exact runtime asset or affected-agent queue when the blocking condition is actually a runtime-governance failure
- `Agents` governance issue cards now preserve the current object-level model and tool filters when they are already in scope, so issue triage can stay within the same governed runtime slice instead of reopening the broader tenant-wide list
- `Admin` runtime-governance watchlist and quick-action follow-up now also prefer object-scoped active-definition queues for disabled models, disabled tools, disabled retrieval posture, and approval-bound tools, so cross-tenant governance review can move directly into the affected agent set
- `Operations` recovery-agent cards now surface runtime-governance blockers and approval-bound tools directly inside the recovery control surface, with focused links into runtime settings and impacted definitions, so workflow supervision and runtime governance can operate as one continuous path
- approval-bound registered tools are now represented as a first-class agent-governance issue, so the platform can isolate approval-dependent definitions as an explicit review queue without turning approval posture into the same hard activation failure as missing or disabled runtime dependencies
- `Settings`, `Admin`, and `Operations` now all converge on the same approval-bound active-definition queue for a selected tool registration, so approval review is part of the connected governance path rather than only a registry-side annotation

The current operations surface includes:

- a clearer execution-lane split between overview, failed recovery, retry review, and queue pressure
- tenant-level workflow supervision independent from the workspace surface
- dedicated queue cards for queued, running, failed, and retry-derived runs
- workflow search, status filtering, and retry-mode filtering
- selected-run detail with step-level execution visibility
- controlled retry actions from the dedicated operations plane
- direct handoff links into workspace workflow detail, subject documents, agents, and admin governance
- tenant-aware visibility into active agents available for operational recovery support
- active workflow-recovery agent visibility with direct handoff into filtered agents and failed-run queues
- operations-scoped agent runtime observability with recorded launches that specifically entered the operations surface
- operations-scoped workflow-recovery execution-task history with current task-state visibility
- operations-scoped bound-tool trace visibility inside recovery execution cards
- operations-originated runtime handoff recording into chat, documents, workflow follow-up, and admin governance routes
- URL-persisted tenant, status, retry-mode, query, and selected-run state for shareable operations deep links

The current home surface includes:

- a dedicated operating-architecture band that maps governance, knowledge preparation, ingestion, grounded answers, and agent extension into live surfaces
- scope-aware tenant, workspace, and knowledge base selection on the overview page
- connected tenant, workspace, knowledge base, document, and workflow summary counts
- scope-aware chat activity metrics
- failed document attention entries
- failed workflow attention entries
- scoped agent runtime launch counts and recent launch history
- queue-level links into failed document and failed workflow review
- operator-attention recovery buttons that route failed documents and failed workflows into the right built queue
- recent persisted conversations with direct return into the active workspace chat context
- recent active conversation cards with message counts and latest-activity timestamps
- direct chat resume actions from home conversation metrics into the current workspace scope
- direct navigation into workspace chat, document operations, workflow operations, and admin governance
- API-backed tenant-scoped agent definitions with persisted create, update, duplicate, and delete behavior
- explicit agent operating lanes for grounded chat, document intake, workflow recovery, and governance review
- agent search, status filtering, and structured knowledge-base scope selection wired to live platform resources
- agent mode filtering plus mode-aware runtime handoff into chat, document operations, and workflow operations
- persisted `agent_runs` launch history for handoff into chat, document operations, workflow operations, and admin governance
- persisted `agent_executions` task history with execution-state metrics, grounded runtime previews, and generated operational summaries
- multi-entry runtime handoff recording from `Home`, `Admin`, `Workspace`, and `Operations`, not only from the dedicated `Agents` console
- recent agent-run counts, filtered launch-history slices, and recorded-route reopening inside the `Agents` console
- recent execution-task counts, execution-state filters, and execution-result visibility inside the `Agents` console
- readiness filtering inside the `Agents` console so governance handoffs can isolate runtime-ready or attention-needed definitions
- issue-class filtering and grouped governance issue lanes inside the `Agents` console so scope, model, and tool failures can be isolated before editing
- URL-persisted agent tenant, status, search, and selected-definition state for governance handoff
- URL-driven deep links into precise workspace context and target items
- actionable knowledge base inventory, recent conversation, and tenant directory cards
- URL-persisted home scope selection for tenant, workspace, and knowledge base context
- runtime governance posture summaries inside `Settings` with direct follow-up into `Agents` and `Admin`
- runtime governance posture in `Settings` now reads real active agent bindings across tenants instead of only static model/tool inventory
- issue-specific governance follow-up from `Settings` and `Admin` into active-agent remediation queues for missing scope, missing model, disabled model, missing tools, and disabled tool bindings
- tool preview diagnostics inside `Settings` now expose retry attempts, timeout posture, request metadata, response metadata, and upstream HTTP status
- retrieval governance now includes persisted `retrieval_profiles` with default resolution, knowledge-base assignment, and runtime delete protection while a profile is still in use
- retrieval-backed chat, direct retrieval diagnostics, and grounded agent-execution previews now resolve retrieval behavior through governed retrieval profiles instead of relying only on static hybrid defaults
- the `Agents` console now also resolves the effective retrieval profile for the selected knowledge scope, including knowledge-base-bound and platform-default runtime posture
- recent execution records in `Agents`, `Home`, `Admin`, and `Operations` now also expose retrieval-profile metadata from grounded execution payloads
- recent grounded execution records in `Agents` now also expose the active retrieval-engine identity alongside retrieval profile, retrieval mode, and effective top-k
- `Agents` and `Operations` execution review now also expose actual runtime engine, configured runtime engine, graph workflow identity, and explicit native fallback posture for the LangGraph pilot path
- grounded execution review inside the `Agents` console now also exposes execution input, answer preview, and retrieval-hit counts for the selected execution record
- workflow-recovery execution review inside `Operations` now also exposes recorded execution input and follow-up action hints from the persisted execution payload
- `Home` and `Workspace` retrieval diagnostics now show the active retrieval engine, effective retrieval-profile metadata, profile source, and effective top-k for the live scoped query
- `Home` and `Workspace` retrieval diagnostics can now compare `native` and `llamaindex_pilot` retrieval output on the same scoped query before any retrieval-engine switch is trusted
- retrieval comparison now also returns a recommendation state plus explanation so pilot-engine review has an explicit approve-or-hold signal instead of a raw diff only
- retrieval runtime now also reranks fused candidates through a native query-alignment pass, and both retrieval diagnostics and grounded chat metadata expose whether rerank ran, which strategy was used, and the reranked result order
- workspace grounded-chat entry now also reflects the latest retrieval validation posture from inspect and compare runs, so validation-ready, review-needed, hold, empty, and failed states show up in the main operator path before the next question is sent
- the same retrieval validation posture now also drives workspace runtime packets, runbooks, and header status, so `Documents -> Operations -> Chat` keeps one shared answer-readiness state instead of splitting validation into a chat-only concern
- `Home` now also consumes that retrieval validation posture for its primary route, command packets, retrieval diagnostics entry, and retrieval-status messaging, so the platform landing surface no longer advertises grounded chat as ready when the latest evidence check is actually blocked or still under review
- `Home` now exposes the current runtime-governance posture directly in the visible core surface, including the active default chat model, retrieval engine, agent runtime engine, and optional pilot readiness
- API health now normalizes the reserved `langgraph_reserved` alias back to `langgraph_pilot`, so runtime posture stays consistent with the real supported engine names
- visible execution-review surfaces now also expose the resolved runtime binding so operators can see whether a task used a governed model endpoint or the service default runtime
- recent ready documents and completed workflow runs in `Home` now hand off directly into grounded chat validation instead of stopping at a passive document-only success state
- `Settings` now includes retrieval-profile governance alongside model-endpoint and tool-registration governance
- workspace and admin knowledge-base management flows now allow direct retrieval-profile assignment during create and edit actions

## Agreed Navigation Direction

The current implementation now exposes dedicated top-level routes for `Chat`, `Documents`, `Agents`, `Operations`, and `Settings`, while the shared `Workspace` route remains as a compatibility entry for deeper context-preserving links.

### Primary navigation

- `Home`
- `Chat`
- `Documents`
- `Agents`

### Top-right global utilities

- `GitHub`
- `Language`
- `Theme`
- `User Avatar`

### Avatar dropdown

- `Admin`
- `Operations`
- `Settings`
- `Sign out`

### Navigation intent

- `Home` is the connected platform overview and quick-entry surface
- `Chat` is the grounded conversation destination
- `Documents` is the knowledge-asset and document-operations destination
- `Agents` is approved as a first-level destination and may begin as a structured UI shell before its runtime is fully mature
- `Admin` is the control plane for platform governance
- `Admin` is now also separating member access from security review instead of treating all governance activity as one page
- `Operations` is the execution and workflow supervision plane

### Navigation rules

- primary navigation should stay user-goal-oriented
- `Workflows` should not remain a permanent top-level navigation item for all users
- workflow visibility should increasingly live inside `Operations` or in document-context workflow views
- incomplete modules may use UI placeholder pages when they preserve real information architecture instead of inventing fake finished product claims
- `MCP` remains outside navigation and is treated as an internal reserved integration boundary

### Planned admin and operations breakdown

`Admin` should converge toward:

- `Overview`
- `Directory`
- `Security`
- `Models`
- `Tools`
- `Observability`
- `Settings`

`Operations` should converge toward:

- `Workflow Runs`
- `Ingestion Jobs`
- `Failed Runs`
- `Retry Queue`
- `Queue Status`
- `Activity Log`
- `Execution Detail`

### API service

The current API includes:

- tenant APIs
- workspace APIs
- knowledge base APIs
- document APIs
- retrieval API
- hybrid retrieval merge for vector and lexical chunk recall
- chat APIs
- workflow APIs

### Worker service

The current worker path includes:

- document ingestion
- plain text, Markdown, HTML, CSV, JSON, PDF, DOCX, and XLSX normalization
- chunk generation
- embedding generation
- vector persistence
- reindex support

## Current End-to-End Operator Path

RagPilot already supports a meaningful local operator workflow:

1. create or select a tenant
2. create or select a workspace
3. create or select a knowledge base
4. upload a document
5. start durable ingestion
6. inspect document and workflow state
7. ask a grounded question with citations
8. reindex or soft delete documents when needed

The platform-level technology path should keep converging on this broader production chain:

1. identity and access entry
2. tenant and workspace scope resolution
3. knowledge-base setup and retrieval-governance assignment
4. document ingestion and workflow execution
5. retrieval validation and grounded answer generation
6. agent execution, recovery, or escalation
7. governance review, remediation, and audit visibility

Any future technical adoption such as retrieval frameworks, agent runtimes, model gateways, or tool runtimes should be landed through that chain rather than beside it.

## Current Delivery Status

Implemented:

- monorepo and infrastructure foundation
- product, architecture, and runbook documentation baseline
- grounded chat with persisted conversations and citations
- hybrid retrieval baseline with vector recall, lexical recall, and fused ranking
- document upload, detail, reindex, and soft delete
- document filtering, sorting, pagination, and paging headers
- document bulk reindex and bulk soft delete with result summaries
- workflow filtering, sorting, pagination, detail, retry, and lineage support
- dedicated operations console for tenant-level workflow supervision and retry handling
- workflow retry-mode filtering for original versus retry execution runs
- explicit retry conflict handling when failed runs point to deleted source documents
- frontend retry eligibility checks for failed workflow runs before operators issue a retry
- document-scoped workflow history loading for workspace activity and related-run inspection
- richer document and workflow operator panels with processing health, token counts, subject labels, and runtime details
- document registry version summaries so operators can see parser, chunks, and token totals directly in the list
- version-aware document inspection so operators can open specific historical document versions from the sidebar
- document registry workflow summaries so operators can see each document's latest workflow state directly in the list
- operator-facing API error parsing for cleaner status and failure feedback in the web console
- document and workflow summary metrics endpoints for console surfaces
- conversation metrics endpoint for home, workspace, and admin chat activity surfaces
- richer conversation list payloads with message counts, latest activity timestamps, and list limits
- Temporal-backed ingestion workflow
- Temporal worker compatibility for legacy `DocumentIngestionWorkflow.run` executions
- non-retryable handling for deterministic ingestion failures such as missing workflow context and empty chunk output
- admin-style context management in the web console
- lifecycle controls for workspace and knowledge base
- persisted user directory and tenant membership API foundations
- admin member directory with tenant-scoped membership actions, membership removal, membership-status filters, account-status filters, and persisted member-profile editing
- reviewer-vs-super-admin write boundaries in the admin console for local governance sessions
- reviewer-vs-operator write boundaries in `Agents`, plus retry-action boundaries in `Operations`
- initial backend actor-header enforcement for sensitive write routes
- backend actor-header enforcement now covers admin resource writes such as tenant creation, workspace lifecycle, and knowledge-base publication
- backend actor-header enforcement now also covers admin member creation through `POST /api/v1/users`
- backend actor-header enforcement now also covers document mutation routes such as upload, reindex, and delete
- backend actor-header enforcement now also covers chat mutation routes such as conversation create, message send, rename, and delete
- login-session sync with the persisted user directory by email through a dedicated bootstrap route
- pre-sign-in login assessment through `/api/v1/users/login-assessment` so bootstrap, invited, inactive, and missing-directory states are explicit
- inactive persisted member accounts are now rejected by the local sign-in flow
- persisted members with only invited or suspended tenant memberships are now rejected by local sign-in and session restore
- settings-page profile sync back into the persisted user directory
- session-level membership visibility in the avatar menu and settings surface
- startup session rehydration against persisted directory users by id
- browser-focus session refresh against persisted directory user state
- session-close reason feedback on the login surface after directory revocation or loss of usable membership scope
- backend current-user permission snapshots through `GET /api/v1/users/me/permissions`, now consumed by protected web routes as the next step toward server-owned RBAC
- action-level web capability checks now use the same permission snapshot for core write paths such as chat sending, document upload and lifecycle actions, workflow retry, agent definition changes, agent execution, admin writes, workspace context resource management, and runtime-governance management
- backend core write routes now use the same named capability language for documents, chat, workflow retry, agent definition changes, agent execution, admin resource governance, and runtime governance
- member-directory APIs now use the same capability language for admin-console review, member-management writes, audit-event review, and self-service profile access
- the current-user permission snapshot and all current protected route families now prefer database-backed role grants, while the centralized code-level policy remains the fallback seed contract when the database policy is unavailable or unseeded
- server-driven workspace registry and workflow timeline loading
- URL-driven workspace conversation targeting and operation-state persistence
- persisted conversation management through explicit create and rename actions
- persisted conversation lifecycle management through explicit create, rename, and delete actions
- conversation search, limit controls, and recent-activity ordering support through the chat list API

Not yet complete:

- final production authentication, session control, and RBAC
- full multi-user administration
- broader parser coverage and deeper structured extraction
- evaluation center
- deeper model governance hardening such as secret handling and provider health history
- mature MCP and agent workflows
- production deployment hardening and advanced observability

## MCP Status

The repository includes an `apps/mcp-server` package, but it is still a placeholder integration boundary.

Current meaning:

- it reserves a future MCP-compatible tool surface
- it is not yet a mature exposed platform feature
- it should not drive current navigation decisions
- future product exposure belongs under admin-facing `Tools` or `Integrations`

## Current Delivery Stage

RagPilot is currently between:

- completed Phase 4 runtime-governance and operator-chain consolidation
- active Phase 5 public release hygiene and engineering closure

This means the core platform path is already real, while the current remaining pressure is shifting toward production authentication, deeper evaluation, mature MCP management, and release hardening.

Current release-preparation posture now also includes:

- repository hygiene for local-only runtime output
- public contribution and security policy files
- minimal CI
- first-publish and first-tag runbooks
- initialized local Git repository baseline on `main`

## Next Strategic Priorities

1. continue stabilizing the admin and operator console structure
2. improve document and workflow operator depth, feedback, and auditability
3. expand parsing and ingestion coverage
4. add auth, memberships, and RBAC
5. improve retrieval quality with evaluation, feedback, and pilot-engine decisioning
6. strengthen MCP boundaries and production readiness

## Primary References

- [Project Blueprint](./project-blueprint.md)
- [Platform Blueprint Reference](./platform-blueprint-reference.md)
- [System Overview](../architecture/system-overview.md)
- [Repository Structure](../architecture/repository-structure.md)
- [API Outline](../api/api-outline.md)
- [Roadmap](../planning/roadmap.md)
- [Local Development Runbook](../runbooks/local-development.md)
