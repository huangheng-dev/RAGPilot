# RagPilot Roadmap

## Purpose

This roadmap tracks the current delivery stage, near-term priorities, and later platform expansion goals.

## Current Delivery Status

### Completed foundations

- monorepo structure
- English-first naming system
- product, architecture, API, and runbook documentation baseline
- Docker Compose local stack
- Next.js web application foundation
- FastAPI API foundation
- Temporal worker foundation
- document upload and durable asset storage
- Temporal-backed ingestion path
- chunk and embedding persistence
- retrieval-backed grounded chat with citations
- hybrid retrieval baseline with fused vector and lexical recall
- workflow retry and lineage support
- admin-style context switching and lifecycle controls
- scope-aware home overview selection across tenant, workspace, and knowledge base context
- home overview scope state now persists in the URL for stable deep-link entry
- home overview now includes live recent document, workflow, and active-agent snapshots instead of only static status cards
- agent-runtime handoff context now starts flowing through URL state across `Home`, `Agents`, `Operations`, and workspace surfaces
- workspace `Chat` and `Documents` surfaces now react to the active agent handoff with mode-aware guidance and quick lane switching into documents, workflows, and chat follow-up
- workspace `Workflows` now also reacts to the active agent handoff so supervision stays aligned with grounded-chat, document-intake, or recovery lanes
- workspace now also exposes a default operator-flow packet and three-step runbook even without an incoming handoff, so upload, supervision, and grounded validation stay visible as one connected path
- document upload now automatically focuses the resulting document or workflow run, then routes operators into either grounded-validation follow-up or workflow recovery based on the live run outcome
- `Home` now promotes a dynamic primary operator route, so recovery, monitoring, intake, or grounded validation is opened according to live scope state instead of a fixed static button set
- `Home` primary routing, command packets, and retrieval diagnostics now also react to the latest retrieval validation posture, so answer-ready, review-needed, and blocked evidence states stay aligned with the workspace continuation path
- `Home` command-center routing now also treats `Documents -> Operations -> Chat` as the canonical core path, so intake, monitoring, recovery, and validation actions stop mixing workspace-level and operations-level entry semantics
- `Home` implementation now also drops dormant admin/governance/observability landing sections from the page code, so the rendered surface and the maintained code both stay aligned with the “three primary lanes only” product rule
- workspace `Chat`, `Documents`, and `Workflows` now expose stronger empty-state and healthy-state follow-up actions, so operators can keep moving along the core path without guessing the next screen
- selected document and workflow side panels now also expose state-based next actions for ready, active, and failed states, so the operator can continue from detail inspection without mentally reconstructing the next lane
- workspace surface transitions now preserve stronger handoff intent for validation and recovery, including automatic validation prompts when operators return to chat from completed document or workflow states
- document reindex action summaries now also resolve the next follow-up lane from live workflow state, so operators are pushed toward supervision while runs are active and toward grounded validation only after readiness is real
- `Operations` runtime task packets now also resolve queue-monitoring, intake-return, and validation-return states even before a specific workflow run is selected, so the operations surface behaves like a real control layer instead of a run-detail dependency only
- document upload now also leaves a persistent follow-up card inside the documents surface, so indexing success, monitoring-in-progress, and recovery-needed states remain actionable after the transient status bar message disappears
- `Home` recent documents, workflow snapshots, and execution cards now route according to live state, so clicking recent activity continues the core operator loop instead of reopening generic list pages
- direct governance actions for workspace archive/restore and knowledge base publish/draft
- document search, sort, filtering, pagination, and batch operations
- version-aware document detail inspection for citation traceability and historical review
- governance filtering for workspace lifecycle and knowledge base publication
- persisted member directory and tenant membership management foundations in the admin console
- local mock sign-in now syncs against persisted user-directory records so future auth replacement has a closer contract
- local session restore now also rejects persisted directory users who no longer have any active tenant membership
- local session restore is now moving through an authenticated `users/me` API path instead of open directory reads during browser refresh
- current signed-in members can now review their own recent access activity through an authenticated `users/me/access-events` path surfaced in `Settings`
- `/login` now resolves directory posture before sign-in so bootstrap, invited, inactive-account, inactive-membership, and missing-directory states are explicit
- browser-session refresh now also revalidates persisted directory state on focus and visibility return
- login now also surfaces session-close reasons after directory invalidation, instead of silently returning to a blank sign-in form
- directory-backed sign-in now also returns backend-issued bearer sessions persisted in `user_sessions`, so protected web reads can resolve through formal server session state instead of only browser-local actor headers
- protected route refresh now prefers authenticated `/users/me` and `/users/me/permissions` reads using those backend-issued bearer sessions
- `Home` now exposes a business-architecture band that maps the live platform path into governance, knowledge, execution, answer, and agent lanes
- `Admin` is now moving through explicit governance sections instead of behaving like a single undifferentiated page
- `Admin` now also has a dedicated security-review lane for invitation timing, dormant accounts, and sensitive access events
- `Operations` is now moving through explicit execution lanes instead of behaving like one flat run list
- `Agents` is now moving through explicit operating lanes instead of behaving like a standalone draft editor only
- first-user bootstrap status is now exposed explicitly so the initial persisted `super_admin` path is controlled instead of implicit
- tenant invitations now have issueable activation codes instead of relying on status mutation alone
- tenant invitations now also carry expiration windows so member activation can move closer to real authentication behavior
- open bootstrap provisioning is now intentionally closed after the first persisted directory user
- directory login eligibility is now moving to the API layer instead of staying in browser-only checks
- member governance now has first audit anchors for invitation issuance and successful sign-in activity
- invitation revocation is now part of the built governance path instead of being an implied manual workaround
- recent member access events are now entering the admin operating surface
- recent member access events can now be filtered by event type in the admin console
- governance-triggered invitation and membership actions now carry a persisted note in the access-event trail
- local role-based admin write boundaries for `reviewer` and `super_admin`
- tenant membership removal is now part of the built member-governance baseline
- action-level RBAC is now extending into agent editing, workflow retries, and local session role management
- backend actor-header authorization now mirrors the built frontend RBAC boundaries across core protected routes
- admin resource mutation routes are now part of the same backend actor-authorization rollout
- admin member creation now joins the same backend actor-authorization rollout, while login bootstrap keeps its own dedicated provisioning path
- document-operation mutation routes are now joining the same backend actor-authorization rollout
- chat mutation routes are now joining the same backend actor-authorization rollout
- `GET /api/v1/users/me/permissions` now exposes a backend-owned current-user capability snapshot, so protected web routes can start migrating from local role guesses toward server-defined RBAC behavior
- critical web actions now consume the backend permission snapshot for chat writes, document operations, workflow retry, agent editing and execution, admin writes, workspace context resource management, and runtime-governance management
- backend write routes for the same core actions now resolve through named capabilities, reducing drift between frontend action gating and API enforcement
- member-directory APIs now also distinguish admin-console review, member-management writes, audit-event review, and self-service profile access through named capability or self-access checks
- RBAC capability naming remains centralized in a shared access policy so permission snapshots, frontend gating, and route checks keep the same contract while the database policy layer takes over enforcement
- database-backed RBAC tables and default grants are now in place as the first step toward replacing the code-level policy source
- the current-user permission snapshot now reads database role grants first and keeps the code-level policy as a transitional fallback
- runtime-governance routes now use database-policy-first checks for model endpoint, tool registration, and retrieval profile read/write access
- admin resource governance routes now use the same database-policy-first checks for tenant, workspace, and knowledge-base management writes
- operator routes now use the same database-policy-first checks for chat writes, document writes, workflow retries, agent definition changes, and agent execution
- member-directory routes now use the same database-policy-first checks for admin-console review, member-management writes, audit review, and self-access exceptions
- persisted model endpoint registry foundations are now part of the built platform-governance surface
- persisted tool registration inventory foundations are now part of the built platform-governance surface
- agent definitions can now persist runtime model-endpoint bindings and registered-tool bindings
- grounded chat can now resolve an agent-bound governed model endpoint at runtime instead of relying only on the global chat-model setting
- grounded-chat agent executions can now produce retrieval-backed runtime previews through the resolved model adapter, while operational agent lanes keep deterministic task summaries
- bound tool registrations can now move through a first tool-runtime layer with native execution, approval gating, live HTTP invocation, reserved MCP traces, and per-execution invocation summaries
- tool registrations now also expose a preview-invocation API path so registry governance can verify runtime behavior without waiting for a full agent execution, and the web settings surface can inspect the returned trace
- HTTP tool-runtime invocation now carries retry-aware request and response metadata, plus retry handling for transient upstream status codes before a final trace is recorded
- agent launches now also persist `agent_runs` history so handoff into `Chat`, `Documents`, `Operations`, and `Admin` is auditable instead of transient
- agent executions now also persist `agent_executions` task history so selected definitions can move through queued, running, completed, and failed execution states with generated runtime summaries
- the `Agents` console now shows recent persisted run history and launch counts for the current tenant or selected definition
- the `Agents` console now also shows execution-task history and execution-state metrics for the selected definition, instead of only launch telemetry
- `Home` now also surfaces scoped `agent_runs` activity so recent launches and runtime volume stay visible from the platform overview
- `Admin` now also surfaces governance-scoped `agent_runs` observability so cross-tenant runtime usage is visible without leaving the admin console
- scoped runtime handoff actions in `Home`, `Admin`, and `Workspace` now also write `agent_runs` before navigation, so runtime movement is becoming multi-entry auditable instead of only agent-console initiated
- `Operations` now also surfaces operations-scoped `agent_runs` observability so recovery handoff traffic can be inspected alongside workflow supervision
- `Operations` now also surfaces workflow-recovery execution-task history so recovery agents can be observed as actual execution tasks instead of launch records only
- `Operations` now also surfaces per-execution bound tool traces so recovery follow-up can inspect which tool checks ran, failed, or were blocked without leaving the operations console
- `Admin` now also surfaces governance-scoped execution-task observability with cross-tenant execution counts, recent execution traces, and bound-tool trace visibility
- operations-originated handoff actions now also write `agent_runs`, so runtime movement is becoming auditable across `Home`, `Admin`, `Workspace`, `Agents`, and `Operations`
- `agent_runs` API queries now support filtered reads by target surface, trigger source, and run status for more precise runtime observability slices
- the `Agents` console now also exposes runtime-history filters for target surface, trigger source, and run status, so operators can inspect narrower launch slices without leaving the definition surface
- the `Agents` console now also supports readiness filtering, so governance can isolate runtime-ready or attention-needed active definitions directly from URL state
- the `Agents` console now also supports governance-issue filtering and grouped issue lanes, so missing scope, model, and tool failures can be isolated directly from URL state
- `Admin` now also aggregates cross-tenant workflow pressure so governance can inspect failed, queued, running, and retry workflow volume before jumping into `Operations`
- `Admin` now also aggregates cross-tenant document intake and failure pressure so governance can inspect failed and in-flight document volume before jumping into `Documents` or `Operations`
- `Admin` now also aggregates runtime-governance posture across model endpoints, tool registrations, and active agent bindings so disabled runtime resources and approval-gated tools stay visible from the governance overview
- `Admin` runtime governance now also deep-links into issue-specific active-agent queues for scope, model, and tool follow-up instead of only a generic attention slice
- `Settings` runtime governance now also surfaces posture summaries and direct follow-up actions into `Agents` and `Admin`, instead of acting only as a static registry editor
- `Settings` runtime governance posture now also reads real active agent bindings across tenant scope, instead of estimating posture from registry resources alone
- `Settings` runtime governance now also deep-links into issue-specific active-agent queues so runtime resource governance can move directly into the right remediation slice
- `Settings` tool preview now also exposes request and response metadata such as retry attempts, timeout posture, and upstream HTTP status so tool-governance review can inspect runtime diagnostics without leaving the registry surface
- `Home` now also exposes scoped runtime-governance signals and follow-up packets so model, tool, and active-agent pressure can be seen before diving into `Admin` or `Agents`
- `Home` now also surfaces tenant-scoped `agent_executions` observability with recent execution tasks, execution-state counts, and bound-tool trace visibility instead of showing only launch telemetry
- platform retrieval governance now includes a persisted `retrieval_profiles` registry with default-profile handling, delete blocking while knowledge bases are still assigned, and runtime-safe assignment rules
- knowledge bases can now carry a `retrieval_profile_id`, so grounded chat, direct retrieval diagnostics, and grounded agent executions resolve retrieval behavior from governed profile state instead of only fixed settings
- retrieval diagnostics now expose the effective retrieval profile, profile source, retrieval mode, and effective top-k so operators can see which governed retrieval posture actually ran
- retrieval runtime now also applies a native rerank pass across an explicit candidate window, so grounded answers can reorder fused results with query-alignment signals before citations are attached
- retrieval validation now also flows back into the workspace chat entry state, so compare-or-inspect outcomes are visible as a real operator gate instead of a detached diagnostics panel only
- retrieval validation posture now also drives workspace runtime packets, runbooks, and header state, so the operator can see whether to continue in grounded chat or fall back into source review from any workspace lane
- assistant-message feedback can now be stored directly on persisted grounded answers, so operators can mark a response as helpful or flag it for retrieval review without leaving the chat lane
- workspace chat now also surfaces a compact answer-feedback queue with direct conversation return, so retrieval-review candidates become a real operator worklist instead of an invisible stored signal
- retrieval-review items now also expose the source user question for one-click validation follow-up, so answer feedback can flow back into retrieval diagnostics without reconstructing the failed prompt by hand
- retrieval-review items can now also start a direct retrieval comparison run on the same source question, so candidate-engine review is becoming part of the real operator feedback loop instead of a standalone diagnostics utility
- workspace retrieval diagnostics now also persist inspect and compare runs as recent scoped evaluation records, so retrieval-review history is becoming a durable operator asset instead of a transient panel state only
- workspace retrieval diagnostics now also aggregate persisted evaluation history into repeated-query tuning candidates with direct inspect, compare, chat, and source-document follow-up actions, so bad-answer feedback can move into a real retrieval-adjustment queue instead of stopping at history review
- workspace retrieval tuning candidates now also deep-link into focused knowledge-base governance and retrieval-profile governance, so repeated diagnostics pressure can flow directly into governed remediation instead of ending in the operator panel
- `Settings` now exposes retrieval-profile CRUD beside model and tool governance, so runtime resource governance is no longer limited to provider and tool inventory
- workspace and admin knowledge-base create/edit flows now expose retrieval-profile selection, so governed retrieval behavior can be assigned from the current management surfaces instead of requiring direct API use
- `Admin` knowledge-base governance now also surfaces the effective retrieval profile and retrieval mode for each visible knowledge base, including platform-default fallback visibility
- `Admin` knowledge-base governance now also supports retrieval-profile filtering, so governance can isolate one effective retrieval posture at a time instead of scanning the entire directory
- the `Agents` console now also resolves and displays the effective retrieval profile for the selected knowledge scope, so runtime dependency review covers model, retrieval, and tool governance together
- recent execution cards in `Agents`, `Home`, `Admin`, and `Operations` now also surface retrieval-profile metadata from grounded execution payloads, so governed retrieval posture remains visible after execution is recorded
- `Admin` runtime governance now also surfaces retrieval-governance pressure such as disabled bound retrieval profiles, explicit retrieval bindings, disabled-profile assignments, and platform-default fallback usage
- the `Agents` console now also surfaces execution input, grounded answer preview, and retrieval-hit counts for grounded execution records, so execution review carries more than summary text alone
- `Admin` watchlist now also includes retrieval-governance pressure, so disabled-profile assignments and platform-default fallback usage can be triaged from the same governance queue
- `Operations` workflow-recovery execution cards now also surface recorded execution input and recommended follow-up actions, so recovery review stays attached to the actual execution brief
- recent execution cards in `Home`, `Agents`, `Admin`, and `Operations` now also surface top grounded evidence sources and retrieval-method mix, so operators can inspect which documents actually supported a recorded execution
- `Admin` overview now also includes a retrieval-profile governance board, so each governed retrieval posture can be reviewed as a scoped asset with assignment counts, fallback coverage, and direct follow-up into directory filters
- agent readiness now also treats missing or disabled governed retrieval profiles as first-class attention issues, so active `grounded_chat` and `document_intake` definitions cannot look healthy while their scoped knowledge base has retrieval-governance gaps
- `Home`, `Admin`, and `Settings` runtime-governance follow-up now also deep-link into retrieval-specific agent issue slices, so retrieval governance is no longer isolated from model and tool remediation
- the `Agents` console now also exposes retrieval-specific execution packets and release-board follow-up, so retrieval-governance fixes can be opened directly from the primary agent control layer instead of only the lower-level detail panels
- `Admin` runtime handoff cards now also distinguish retrieval-missing versus retrieval-disabled routes, and treat retrieval-governance cleanup as part of launch readiness rather than only scope resolution
- retrieval-governance remediation links can now deep-link directly into focused `Settings` retrieval-profile objects, so operators no longer have to open the registry and manually find the governed profile after leaving `Agents` or `Admin`
- `Admin` now also accepts object-level knowledge-base governance deep links through `knowledge_base_id` and `management_panel=knowledge-base-edit`, so runtime remediation can land directly on the affected knowledge-base edit surface instead of only a filtered directory list
- retrieval-governance follow-up from `Agents` and `Admin` now prefers direct knowledge-base governance entry when a scoped knowledge base is known, keeping missing/disabled retrieval cleanup tied to the concrete governed object
- `Admin` object-level governance deep links now also cover `workspace_id` with `management_panel=workspace-edit` and `user_id` with `management_panel=user-edit`, so workspace lifecycle and member-directory review can land directly on the governed object instead of only the surrounding list
- access audit cards and current-actor security posture can now open the concrete member governance object, extending admin deep-link behavior from runtime assets into access-control and directory governance
- `Operations` governance follow-up now prefers the concrete scoped workspace when one is known, so workflow-recovery remediation can move directly into workspace governance instead of resetting at the generic admin overview
- `Operations` governance follow-up now prefers the concrete scoped knowledge base before falling back to workspace governance, so document-oriented recovery can land on the exact governed knowledge asset instead of only the broader workspace shell
- admin access packets and security watch items now also prefer the first affected member object for invited, expiring, expired, dormant, and suspended states, so member-governance follow-up can start from a real persisted directory object instead of only filtered summary views
- `Home` governance entry points now prefer the currently selected knowledge base or workspace when an admin-capable actor is already operating inside a scoped surface, so the platform landing page can hand off directly into the active governed object instead of always resetting at admin overview
- `Settings` retrieval-profile governance now links into the filtered admin knowledge-base inventory for the selected profile when bound assets exist, so retrieval tuning can continue directly into affected knowledge-base governance instead of stopping at profile editing
- `Admin Access` now includes a dedicated pending-activation queue with direct invitation issue, activation, revoke, and member-governance actions, so invited-member follow-up can be processed as an operator work queue instead of only as list filtering
- `Settings` now also accepts focused model-endpoint and tool-registration deep links through `runtime_resource=model_endpoint|tool_registration`, so runtime remediation can land on the concrete governed runtime object instead of only the registry top-level surface
- `Home` runtime-governance follow-up now prefers the first affected disabled model, disabled tool, disabled retrieval profile, or approval-gated tool before falling back to the generic settings overview, so operator remediation can begin at the most concrete broken runtime asset
- `Admin` runtime-governance follow-up now uses the same focused settings-object handoff strategy as `Home`, so governance review can move from aggregate pressure signals into the exact model, tool, or retrieval asset without an extra search step
- `Agents` now also supports URL-persisted filtering by concrete `model_endpoint_id` and `tool_registration_id`, so runtime-governance handoff can isolate the exact affected agent set instead of only broader readiness or issue lanes
- `Settings` model and tool governance now include direct follow-up into affected-agent queues, plus disabled-runtime issue queues for the selected runtime object, so registry review can move directly into the operator slice that is actually blocked
- `Operations` recovery governance now also evaluates disabled bound models, disabled bound tools, and disabled retrieval profiles for the focused recovery agent, then prefers targeted `Settings` and filtered `Agents` follow-up when runtime remediation is more urgent than broader workspace governance
- `Agents` governance issue lanes now preserve the current model-endpoint and tool-registration filters when they are already scoped to a concrete runtime object, so issue triage can stay inside the same object-specific queue instead of dropping back to the broader tenant inventory
- `Admin` runtime-governance quick actions and watchlist follow-up now also prefer object-scoped agent-definition queues for disabled models, disabled tools, disabled retrieval posture, and approval-gated tools, so governance review can move directly from cross-tenant posture into the affected active-definition slice
- `Operations` recovery-agent runtime cards now surface disabled model, disabled tool, disabled retrieval, and approval-bound tool posture with direct follow-up into focused runtime settings and impacted definitions, so workflow recovery can pivot into runtime governance without leaving the active recovery context
- approval-bound registered tools are now a first-class `Agents` governance issue (`tool_approval_required`) without becoming a hard runtime-activation blocker, so governance review can isolate approval-bound definitions while preserving the current active-save contract
- `Settings`, `Admin`, and `Operations` now all deep-link into the same approval-bound agent-definition queue for a selected tool registration, so approval posture is no longer only a descriptive badge on the runtime registry
- active agent runtime-governance posture now also resolves through a shared backend contract, so `Agents`, `Admin`, and `Settings` no longer compute model, retrieval, and tool-readiness state independently in the browser
- `Home` and `Operations` now also consume that shared runtime-governance contract for governance entry routing and recovery remediation follow-up, reducing drift across the core operating surfaces
- `Home` runtime governance now also prefers issue-scoped affected-agent queues and concrete MCP/tool settings targets, so landing-surface remediation starts from the exact broken runtime slice instead of a generic active-agent list
- `Home`, `Agents`, `Operations`, and `Admin` now also share one runtime-governance route-resolution layer for model, retrieval, tool, and MCP follow-up, so cross-surface remediation starts from the same concrete target ordering instead of page-local branching
- the shared runtime-governance contract now also supports readiness, issue, and concrete runtime-object filters, so cross-surface follow-up can land on one backend-owned affected-definition slice instead of mixing browser-local queues
- `Settings` runtime-governance objects now also open `Agents` follow-up from backend-filtered active queues for models, tools, approvals, and retrieval profiles, tightening the governance path between registry review and affected definitions
- tool registrations now also expose a backend-owned governance summary for native, HTTP, and reserved MCP transport posture, so tool/MCP review can move through one shared contract before deeper MCP management exists
- tool registrations now also expose a backend-owned runtime-audit queue from persisted execution traces, so settings-side tool and MCP governance can review recent runtime failures and reserved-boundary behavior without relying on page-local trace assembly
- tool runtime-audit traces now also carry governance-issue classification and direct settings/agent follow-up actions, so tool and MCP review can move from observed runtime failures into concrete remediation slices instead of stopping at a trace list
- `Settings` tool governance now also supports direct backend-governed actions such as enable, disable, require-approval, allow-direct-use, and quarantine, so runtime control is no longer limited to manually editing the full tool registration record
- `Settings` tool governance now also includes a tenant-scoped MCP boundary worklist for reserved tools, so reserved-boundary review can move through one backend-owned queue instead of being reconstructed from transport labels and individual audit traces
- reserved MCP tools now also move through explicit `reviewing`, `quarantined`, and `ready_for_integration` boundary states with direct backend-governed transition actions, so the reserved boundary is becoming a real governance lane before deeper MCP management arrives
- reserved MCP runtime preview now also distinguishes “still under boundary review” from “integration cleared but connector not attached”, so governance closure and runtime closure no longer masquerade as the same reserved state
- `Settings` tool governance now also exposes `integration pending` as a formal summary and filter state for reserved MCP tools, so pending connector attachment can be triaged as part of normal runtime-governance review
- reserved MCP tools now also expose a dedicated connector-reference field in governance, so future MCP runtime attachment has a real platform contract instead of relying on descriptions or out-of-band notes
- reserved MCP governance now also blocks `ready_mcp_integration` until that connector reference exists and exposes a dedicated `connector configured` filter, so pre-integration MCP wiring can be reviewed as a governed state instead of a note-taking convention
- MCP governance now also has a first persisted connector registry with connector type, auth, base-URL posture, reference counts, and connector reachability preview, so connector assets can be governed directly in `Settings` before full MCP runtime attachment exists
- `Settings` MCP connectors now also expose connector-scoped linked-tool follow-up, affected-agent counts, and direct connector runtime preview, so connector governance can move from static inventory into real remediation and validation flow
- `Settings` now also shows the connector-to-tool relationship in both directions inside the same governance surface, so reserved MCP tool cleanup and connector review can stay in one operator path instead of bouncing through separate inventories
- `Settings` tool and MCP connector detail views now also use shared action-packet follow-up blocks, so runtime governance entry points are converging even at object detail level instead of re-branching inside each editor
- MCP-related execution traces in `Agents`, `Operations`, and `Admin` now also deep-link into the concrete connector object in `Settings` when a connector reference is present, so runtime remediation can continue at connector governance instead of stopping at the broader tool record
- structured execution follow-up actions now also preserve MCP connector slug targeting for `mcp_integration_pending` posture, so connector-governance handoff can stay intact across shared execution cards and operator surfaces
- agent runtime-governance issue lanes now also include reserved and integration-pending MCP tool posture, so `Agents` and `Admin` can treat connector-readiness gaps as formal remediation slices instead of trace-only anomalies
- execution-surface tool traces in `Agents`, `Operations`, and `Admin` now also use the same governance-issue contract, so runtime review and remediation stay aligned across the primary operator and governance surfaces instead of diverging by page
- recent execution cards in `Agents`, `Operations`, and `Admin` now also expose shared mode-aware follow-up actions into scoped `Chat`, `Documents`, and `Workflows`, so the operator can continue the built product chain directly from recorded execution outcomes
- grounded-validation draft prompts are now also shared across `Home`, document follow-up cards, upload completion, and `Operations -> Chat` handoff, so the core `Documents -> Operations -> Chat` path keeps one consistent validation brief instead of rephrasing by surface
- workspace document and workflow detail panels now also strip duplicated follow-up buttons below the shared execution packet, so state explanation stays visible while the actual continuation actions remain single-sourced
- recent agent-execution payloads now also persist structured recommended-action specs, so those follow-up buttons resolve from one backend-owned action contract instead of page-local heuristics plus free-text suggestions
- recent execution follow-up now also reacts to model fallback, tool-runtime governance issues, and retrieval evidence gaps, so execution review can route directly into `Settings` repair or back into the main operator chain without page-local branching logic
- model endpoints now also expose a backend-owned governance summary for provider, credential, runtime-ready, and missing-base-url posture, so model runtime review can move through one shared contract before deeper fallback and health policies are built
- model endpoints now also expose backend-owned runtime-state queues for runtime-ready, disabled-bound, missing-base-url, managed-reserved, and missing-credential-hint review, so settings-side governance can move through shared API contracts instead of browser-local filtering rules
- chat and agent execution runtime now also resolve governed model fallback through configured endpoint, default endpoint, and service-settings layers, so broken bound model endpoints no longer automatically break the primary operator chain

### Current working state

RagPilot already supports a meaningful end-to-end operator path:

1. create or select tenant scope
2. create or select workspace scope
3. create or select knowledge base scope
4. upload a document
5. run durable ingestion
6. inspect document and workflow state
7. ask grounded questions with citations
8. batch reindex or soft delete documents

## Current Phase

RagPilot is currently in a transition between:

- closed Phase 4: runtime-governance and operator-chain consolidation
- active Phase 5: public release hygiene and engineering closure

The near-term goal is still not broad feature expansion for its own sake.

The near-term goal is to keep hardening the existing core path while making the repository safe, honest, and maintainable for public open-source delivery.

## Near-Term Priorities

### Priority 1

Stabilize the web console structure:

- continue splitting the large workspace and admin surfaces into maintainable modules
- converge toward the approved top-level navigation:
  - `Home`
  - `Chat`
  - `Documents`
  - `Agents`
- keep `Admin` and `Operations` in the avatar dropdown instead of treating them as ordinary primary navigation destinations
- keep operator, governance, and future agent concerns explicit
- improve maintainability for later auth, retrieval, and agent-runtime work

### Priority 2

Deepen resource operations:

- richer document and workflow operator feedback
- clearer action summaries, error follow-up, and auditability
- better lifecycle visibility across managed resources
- more complete management states across Home, Workspace, and Admin
- stronger deep-link entry paths from overview surfaces into operator work queues
- shared navigation rules so workspace deep links remain consistent across Home and Admin
- richer overview and governance entry points that reduce manual context switching for operators
- stronger chat-return paths so recent conversations can be resumed from overview surfaces
- more durable URL state for operator queues so sort, filter, and pagination context survives navigation
- clearer long-term separation between user-facing document operations and deeper workflow supervision
- richer retrieval diagnostics and rerank metadata so grounded answers remain explainable while evaluation work is still pending
- continue evolving the current deterministic agent execution layer into a real model-backed and tool-backed runtime, rather than leaving agent execution at summary generation only

### Priority 3

Expand ingestion and retrieval depth:

- richer structured extraction pipelines beyond the current `TXT`, `Markdown`, `HTML`, `CSV`, `JSON`, `PDF`, `DOCX`, and `XLSX` baseline
- stronger parser fidelity for binary and office formats beyond the initial `PDF`, `DOCX`, and spreadsheet coverage
- keep the existing `llamaindex_pilot` path tied to measurable grounded-answer quality before any promotion decision
- retrieval evaluation aggregation and retrieval-tuning follow-up on top of the landed rerank and answer-feedback baseline

### Priority 4

Add access control foundations:

- production authentication architecture
- memberships
- RBAC
- persisted user directory and tenant membership governance
- external identity and session-governance completion beyond the current backend-issued bearer-session baseline
- secret management and production credential delivery for governed model endpoints
- complete the invited -> active member lifecycle with stronger activation, invite expiry, and audit visibility
- continue replacing transitional browser-local auth assumptions with fully governed backend sign-in, sign-out, session revocation, and governance contracts
- keep any remaining local browser session scaffolding only as compatibility support until the production auth path is fully in place
- deepen governance auditing from recent event visibility into richer actor, reason, and lifecycle traceability
- continue growing the current-user self-service access surface alongside admin-only directory governance
- continue tightening session restoration against persisted directory-user state
- future user administration compatibility

## Mid-Term Phases

### Phase 4 consolidation

Status: `complete`

- stable grounded chat experience
- stronger citation behavior
- better operator visibility
- more polished document and workflow management
- cleaner admin governance surface

### Phase 5

- hybrid retrieval
- native rerank with query-aligned candidate windows
- retrieval profiles
- feedback and evaluation foundation
- native-versus-`llamaindex_pilot` quality comparison and promotion or removal decisioning

### Phase 6

- model governance
- agent definitions
- tool registrations
- runtime binding between agent definitions, governed model endpoints, and governed tool inventory
- agent execution-task orchestration beyond launch telemetry, including task state, generated outputs, and future tool-call traces
- MCP-facing integration maturity
- expansion of the existing bounded `langgraph_pilot` path only when a real agent lane needs graph execution
- local and private model runtime compatibility expansion such as `Ollama` and `vLLM`

## Long-Term Platform Goals

- authentication and RBAC
- user and membership administration
- model provider management
- evaluation center
- usage and audit visibility
- production deployment patterns
- stronger observability and reliability

## Current Non-Goals

Avoid prioritizing these before the core operations path is fully stable:

- consumer-first chat polish
- no-code workflow builders
- advanced autonomous agents
- billing systems
- heavy analytics dashboards
- marketplace-style plugin systems
- unnecessary framework replacement of the current self-managed platform core

## Decision Rule

When choosing what to build next, prefer work that:

1. strengthens the current end-to-end platform path
2. improves operator and admin reliability
3. keeps product boundaries explicit
4. improves future maintainability
