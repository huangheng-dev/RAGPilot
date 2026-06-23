# RagPilot

RagPilot is an English-first, production-oriented, open-source AI knowledge platform focused on knowledge operations, retrieval-grounded chat, and durable ingestion workflows.

## Positioning

RagPilot is not a single chat demo or a thin wrapper around one model provider.

It is being built as a platform that can grow into:

- multi-tenant knowledge operations
- administrator and operator control surfaces
- retrieval-grounded chat with citations
- durable document ingestion and reindex workflows
- model governance and evaluation
- future MCP and agent integrations

It is explicitly not being built as:

- a clone of any legacy PHP project
- a consumer-first chat toy
- a landing-page demo
- a UI shell without durable backend workflows

## Current Product Direction

RagPilot is currently in an operations-first stage.

The active implementation focus is:

- administrator console foundations
- tenant, workspace, and knowledge base management
- document ingestion and document operations
- workflow visibility and retryability
- grounded chat with citations
- lifecycle management for managed resources

The primary product reference is [Project Blueprint](./docs/product/project-blueprint.md).

## Final Blueprint Rule

RagPilot core product flows must be designed and implemented against the final production blueprint, not against temporary development shortcuts.

This rule is especially strict for:

- authentication
- tenant and membership governance
- authorization and protected-route behavior
- document-ingestion lifecycle
- workflow supervision
- agent and tool control boundaries

Implementation guidance:

- temporary local helpers may exist only as replaceable development scaffolding
- scaffolding must not define product architecture, naming, or long-term user flow
- when current code and final blueprint differ, future work must move the code toward the blueprint instead of normalizing the shortcut
- documentation for transitional behavior must label it clearly as transitional

## Lean Product Rule

RagPilot must stay focused on its core product path and avoid feature bloat.

This is now a standing product rule:

- keep only features that directly strengthen the main knowledge-operations workflow
- prefer fewer, clearer pages over many overlapping dashboards, packets, boards, and helper surfaces
- do not add decorative or indirect control layers unless they are required for real user or operator work
- unfinished ideas should remain internal, deferred, or hidden rather than appearing as noisy product surface area
- compatibility routes may remain for technical continuity, but they should not shape the visible product structure

Current core product scope:

- `Home` as a concise overview and entry surface
- `Chat` for grounded question answering with citations
- `Documents` for document upload, ingestion status, indexing state, and document lifecycle
- `Operations` for workflow monitoring, failure review, and retry handling
- `Admin` for tenant, workspace, knowledge base, and member governance
- `Agents` only as a lean definition and runtime handoff surface, not a secondary governance maze
- `Settings` only for essential preferences and lightweight system/session controls

Current visible-console rule:

- `Home` should present only concise scope and activity context
- `Operations` should center on workflow queue work, retry decisions, and selected-run follow-up
- `Admin` should center on governance tables, member activation, and core access controls
- secondary runtime observability walls, explanatory panels, and duplicate status decks should stay hidden until they close a concrete core workflow gap

Implementation guardrail:

- before adding any new module, panel, card group, or control layer, verify that it supports the main `Documents -> Operations -> Chat` chain or a necessary admin-governance task
- if it does not support a real core path, it should be deferred instead of shipped

## Technology Direction

RagPilot keeps its core platform architecture self-managed instead of depending on a general-purpose orchestration framework from the start.

Current foundation:

- `Next.js`
- `FastAPI`
- `Temporal`
- `PostgreSQL`
- `pgvector`
- `Elasticsearch`
- `Redis`
- `MinIO`
- `OpenTelemetry`

Current implemented model-runtime options:

- deterministic local chat generation for development
- `OpenAI-compatible` chat provider routing
- native `Ollama` chat provider routing

Reserved future evaluation:

- `LlamaIndex` as an optional retrieval-domain enhancement, with a minimal pilot adapter now available behind `RETRIEVAL_ENGINE=llamaindex_pilot`
- `LangGraph` as an optional agent-runtime orchestration layer, with a bounded workflow-recovery pilot now available behind `AGENT_RUNTIME_ENGINE=langgraph_pilot`
- `vLLM` as an optional private-inference runtime

These technologies are not part of the current mandatory implementation baseline.
The phased rollout order is tracked in [docs/product/technology-rollout.md](./docs/product/technology-rollout.md).
Project documentation should name only technologies that are either already implemented or explicitly approved as future evaluation candidates for RagPilot.
Do not add unrelated framework names to the documented stack, roadmap, UI labels, or progress reports unless they first become an approved rollout item in [docs/product/technology-rollout.md](./docs/product/technology-rollout.md).
The API health contract and `Settings` runtime cards now also surface whether optional pilot dependencies like `LlamaIndex` and `LangGraph` are actually loadable in the active environment.

## Delivery Cadence

RagPilot implementation should follow a steady batch-based development rhythm:

- advance `3-5` meaningful points in each implementation round when possible
- avoid unnecessary restarts during normal iteration
- restart services only after major changes that could affect runtime behavior, dependency loading, or cross-surface integration
- run focused validation after those major changes so the end-to-end path stays intact

This rule exists to keep delivery momentum high without breaking the working platform chain.

## Current Platform State

This repository already includes:

- `Next.js` web application
- `Tailwind CSS` frontend styling with a shadcn/ui component structure built on Radix UI primitives
- `FastAPI` API service
- `Temporal` worker path for durable ingestion
- `PostgreSQL + pgvector`, `Redis`, `MinIO`, `Elasticsearch`, and `Temporal` via Docker Compose
- grounded chat with persisted conversations, messages, and citations
- grounded chat citations now include retrieval-method and score-breakdown diagnostics
- retrieval API for knowledge-base-scoped context assembly
- governed `retrieval_profiles` with default resolution, knowledge-base assignment, and runtime-visible profile metadata
- tenant, workspace, and knowledge base management APIs
- document upload, document detail, reindex, and soft delete
- document filtering, sorting, pagination, and batch actions in the web console
- backend-aggregated document activity timelines for version and workflow history
- workflow list, detail, retry, and lineage visibility
- workflow retry-mode filtering for original runs versus retry runs
- persisted model endpoint governance for deterministic, OpenAI-compatible, native Ollama, and governed vLLM runtime contracts
- default persisted model endpoints now override raw chat-model settings for general grounded chat when no agent-specific runtime binding is present
- model endpoints now expose a live validation preview path in `Settings` so provider readiness can be checked before operator chat traffic depends on it
- persisted tool registration governance for native, HTTP, and future MCP-oriented callable tool inventory
- agent definitions can now bind persisted model endpoints and registered tools for future runtime activation
- document-scoped workflow history in the workspace document surface
- richer operator detail panels for document processing health and workflow runtime inspection
- document ingestion support for `TXT`, `Markdown`, `HTML`, `CSV`, `JSON`, `PDF`, `DOCX`, and `XLSX`
- hybrid retrieval baseline with vector recall, lexical recall, and fused result ranking
- explicit retrieval-engine boundary with `native` as the active implementation and a reserved `LlamaIndex` slot for the next integration phase
- latest version summaries directly in the document registry
- latest workflow summaries directly in the document registry
- clearer workflow retry conflict handling for deleted source documents
- compatibility coverage for legacy Temporal document-ingestion workflow names
- cleaner operator-facing API error messages instead of raw JSON envelopes
- retry eligibility checks in the workspace before issuing failed workflow retries
- administrator-style filtering for workspace lifecycle and knowledge base publication state
- workflow subject context fields for workspace and knowledge base deep-link resolution

## Current Web Surfaces

The live web application currently exposes these real pages:

- `Home` for the platform homepage, executive summary, and high-level entry points
- `Chat` for grounded conversation operations
- `Documents` for document and knowledge-asset operations
- `Operations` for workflow supervision and execution visibility
- `Agents` as the formal design workspace for agent configuration and execution controls
- `Settings` for local session and platform-entry controls
- `Admin` for governance-oriented resource visibility

The legacy `Workspace` route still remains available as a compatibility entry path for deeper context-preserving links.

Current web-console utilities already include:

- top-navigation language switching between English and Simplified Chinese
- top-navigation light and dark theme switching
- avatar dropdown entry into `Admin`, `Operations`, `Settings`, and sign-out
- a settings surface for local session profile, language, theme, API base URL visibility, repository access, and current-user access activity
- a settings governance surface for persisted model endpoints and tool registrations with role-aware write boundaries
- an agents surface that now binds runtime model endpoints and registered tool inventory into persisted agent definitions

## Target Navigation Architecture

RagPilot should converge toward a clearer top-level navigation structure instead of continuing to grow one mixed operator page.

The agreed target primary navigation is:

- `Home`
- `Chat`
- `Documents`
- `Agents`

The agreed top-right global utilities are:

- `GitHub`
- `Language`
- `Theme`
- `User Avatar`

The agreed avatar dropdown should carry:

- `Admin`
- `Operations`
- `Settings`
- `Sign out`

Navigation rules:

- the primary navigation should contain only user-facing product destinations
- `Admin` and `Operations` should stay in the avatar dropdown instead of the primary navigation
- `Workflows` should evolve into an operations concern or a document-context detail surface, not a permanent primary navigation item
- unfinished modules may ship as UI placeholders when they preserve the information architecture and do not fake completed backend capability
- `Agents` is approved as a first-level navigation destination even before its full runtime is complete, because it is part of the long-term product shape
- `MCP` should remain an internal reserved integration boundary and should not appear as a primary navigation destination

The current home surface is now intentionally narrower and more formal:

- a platform-grade hero and entry experience instead of a second admin dashboard
- live tenant, workspace, and knowledge-base scope selection
- a dedicated operating-architecture band that maps governance, knowledge preparation, ingestion, grounded answers, and agent extension into built pages
- URL-persisted scope selection so the current home context survives refresh and sharing
- direct entry points into `Chat`, `Documents`, `Agents`, and `Admin`
- high-level platform readiness signals instead of dense operational tables
- live recent-activity sections for documents, workflows, agents, and conversation/failure awareness
- agent handoff context can now flow from `Agents` and `Home` into `Chat`, `Documents`, and `Operations`
- `Agents` now exposes explicit operating lanes for grounded chat, document intake, workflow recovery, and governance review
- `Chat` and `Documents` now consume active agent context with mode-aware guidance and fast transitions into the right follow-up surface
- `Operations` now also consumes active agent context so workflow supervision stays aligned with the selected execution lane
- session restoration now resolves through a dedicated authenticated `users/me` API path instead of relying on open directory lookup behavior
- `/login` now performs a dedicated directory login assessment before sign-in so bootstrap, invited, inactive, and missing-directory states are explicit
- the settings surface now also resolves current-user access activity through an authenticated `users/me/access-events` API path
- the local auth provider now refreshes persisted directory session state on browser focus and visibility return
- login now also surfaces why a previous persisted session was closed, instead of silently falling back to a blank sign-in form
- project-resource shortcuts such as repository entry when configured

Current authentication note:

- the present web login is a transitional directory-backed authentication flow, but it now issues backend-managed bearer sessions instead of relying only on browser-local actor headers
- it is useful for current implementation progress, but it is still not the final authentication architecture
- future work must converge toward full production authentication, external or passwordless identity options, sign-out and revocation controls, and final RBAC aligned with the project blueprint

The current operator workspace already supports:

- protected route entry with local mock sign-in
- return-to routing after sign-in for protected workspace and admin pages
- top-navigation language switching between English and Simplified Chinese
- top-navigation light and dark appearance switching
- context switching between tenant, workspace, and knowledge base
- grounded chat with citations
- hybrid retrieval-backed grounded chat with vector and lexical result fusion
- conversation history
- explicit conversation creation from the workspace surface
- conversation title updates for persisted chat threads
- conversation deletion with persisted message and citation cleanup
- cleaner auto-generated titles for new chat threads created from first-user prompts
- workspace-scoped conversation activity metrics and current-thread message counters
- conversation search and recent-activity-first conversation ordering
- conversation list summary fields for message counts and latest activity
- URL-driven conversation search persistence for workspace chat deep links
- document upload and ingestion monitoring for `TXT`, `Markdown`, `HTML`, `CSV`, `JSON`, `PDF`, `DOCX`, and `XLSX`
- document search, filter, sort, pagination, and selection
- batch reindex and batch soft delete with operator feedback
- document action follow-up prompts that route operators into failed document review or workflow supervision
- selected failed documents with direct recovery actions into failed queue review and workflow supervision
- workflow search, status filtering, and workflow type filtering
- workflow supervision shortcuts for failed runs, priority execution queues, and return-to-documents navigation
- richer workflow metrics for queued runs, running runs, and retry-run volume
- workflow inspection and retry from the same console

The current admin surface also includes:

- local role-aware access control for admin entry
- a clearer governance architecture split between `Overview`, `Directory`, and `Access`
- an additional `Security` review lane for invitation hygiene, dormant-account posture, and sensitive governance events
- tenant-scoped conversation activity metrics
- tenant chat activity ranking
- chat signals for active, stale, and idle tenant scopes
- direct operator links from chat activity cards and chat signals into workspace chat scope
- scoped primary-route shortcuts into workspace chat, document, and workflow surfaces
- scoped failed-document and failed-workflow shortcuts from governance scope
- tenant activity cards with direct links into documents and governance
- workspace and knowledge base governance views
- persisted member directory and tenant membership governance
- bootstrap status awareness for the first directory-backed super admin
- invitation-code issuance and regeneration for invited tenant memberships
- invitation expiration windows for invited tenant memberships
- invitation activation through `/login` using email plus membership invitation code
- pre-sign-in login assessment through `/api/v1/users/login-assessment`
- closed directory bootstrap after the first persisted user so later access must come through admin-managed invitations
- server-side directory login resolution through `/api/v1/users/login`
- member governance audit fields for invitation issue count, last invitation issuer, and last successful sign-in
- invitation revocation is now part of the member-governance path
- member access events are now persisted so admin can review recent sign-in and invitation activity
- access-event filtering by event type is now available in the admin governance surface
- governance-triggered membership status changes and invitation actions now persist a structured governance note in the access-event stream
- admin security now also reflects the currently signed-in administrator or reviewer posture inside the same security lane

The current operations surface also now includes:

- a clearer execution-lane split between overall supervision, failed recovery, retry review, and queue pressure
- URL-persisted operations lane state in addition to tenant, status, retry mode, and selected workflow context
- shared route-building into `Admin` and `Operations` so governance and execution deep links stay consistent across top-level consoles

## Current End-to-End Path

RagPilot already supports a real local operator flow:

1. create or select a tenant
2. create or select a workspace
3. create or select a knowledge base
4. upload a document
5. run durable ingestion through Temporal
6. inspect document state and workflow state
7. ask grounded questions with citations
8. reindex or soft delete documents when needed

RagPilot also now supports a real local member-governance flow:

1. bootstrap the first persisted directory user
2. create or edit a directory member in `Admin`
3. invite the member into a tenant scope
4. issue or regenerate a membership invitation code
5. activate the invited membership from `/login`
6. restore the local browser session only when the directory record remains active and has usable membership scope
7. let the signed-in member review recent self-scoped access activity from `Settings`

## Repository Layout

```text
ragpilot/
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
  docs/
    api/
    architecture/
    planning/
    product/
    runbooks/
    templates/
```

## Local Startup

1. Copy `.env.example` to `.env`.
2. Start the local stack:

```bash
npm run compose:up
```

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

For isolated frontend work:

```bash
npm install
npm run web:serve
```

For active frontend debugging only:

```bash
npm run web:dev
```

Optional frontend environment:

- `NEXT_PUBLIC_GIT_REPOSITORY_URL` exposes the GitHub icon in the top navigation only when a real repository URL is configured

For isolated backend and worker setup, use the [Local Development Runbook](./docs/runbooks/local-development.md).

## Current Constraints

RagPilot is still intentionally incomplete in:

- final production authentication, session architecture, and RBAC
- multi-user administration
- broader parser coverage and structured extraction depth beyond the current baseline
- retrieval quality evaluation and automated scoring
- deeper model governance hardening such as secret handling and provider health history
- mature MCP tooling
- production CI/CD and advanced observability

## Public Repository Readiness

RagPilot is now being prepared for a public open-source GitHub release in a controlled way.

Already landed:

- repository ignore rules for local runtime output and private docs folders
- public contribution guidance in [CONTRIBUTING.md](./CONTRIBUTING.md)
- minimal GitHub Actions CI for web build and API tests
- explicit Phase 5 release checklist in [docs/planning/phase-5-release-checklist.md](./docs/planning/phase-5-release-checklist.md)

Still required before the first public push:

- choose and add the final `LICENSE`
- create the first tracked baseline commit
- create the public remote repository
- run one final secret and documentation review

Release preparation references:

- [GitHub Publish Preparation](./docs/runbooks/github-publish-preparation.md)
- [First Public Release Runbook](./docs/runbooks/first-public-release.md)
- [Phase 5 Release Checklist](./docs/planning/phase-5-release-checklist.md)

## MCP Status

The repository already contains `apps/mcp-server`, but it is currently a placeholder service boundary rather than a complete product feature.

Current interpretation:

- MCP is reserved for future tool and integration exposure
- MCP is not a current end-user navigation surface
- MCP should remain decoupled from the current primary product path
- future UI exposure should happen under admin-facing `Tools` or `Integrations`, not as a standalone top-level destination

## Next Milestones

- continue modularizing the workspace and admin web surfaces
- deepen document and workflow operator controls, feedback, and auditability
- add auth, memberships, and permission boundaries
- expand parser coverage and structured extraction beyond the current `PDF` / `DOCX` / `XLSX` baseline
- improve retrieval quality with hybrid search and rerank
- strengthen MCP and agent integration boundaries

## Docs

- [Documentation Index](./docs/README.md)
- [Project Blueprint](./docs/product/project-blueprint.md)
- [Project Snapshot](./docs/product/project-snapshot.md)
- [Platform Blueprint Reference](./docs/product/platform-blueprint-reference.md)
- [API Outline](./docs/api/api-outline.md)
- [System Overview](./docs/architecture/system-overview.md)
- [Repository Structure](./docs/architecture/repository-structure.md)
- [Naming Conventions](./docs/architecture/naming-conventions.md)
- [Platform Data Model](./docs/architecture/platform-data-model.md)
- [Roadmap](./docs/planning/roadmap.md)
- [Phase 5 Release Checklist](./docs/planning/phase-5-release-checklist.md)
- [Local Development Runbook](./docs/runbooks/local-development.md)
- [GitHub Publish Preparation](./docs/runbooks/github-publish-preparation.md)
- [First Public Release Runbook](./docs/runbooks/first-public-release.md)
