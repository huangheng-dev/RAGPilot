# RagPilot System Overview

## Goal

RagPilot is intended to become a deployable open-source AI knowledge platform with clear boundaries between interface, business APIs, retrieval, workflows, model access, and observability.

## Current Realized Architecture

```text
Next.js App Router
-> FastAPI API Gateway
-> Tenant / Workspace / Knowledge / Document / Chat / Workflow services
-> Temporal ingestion orchestration
-> PostgreSQL / pgvector / Redis / MinIO / Elasticsearch
-> Deterministic, OpenAI-compatible, or native Ollama model providers
-> OpenTelemetry collector
```

Current interpretation:

- the web application still exposes a mixed `Workspace` surface for chat, documents, and workflows
- the API and worker path already implement the real document-ingestion and grounded-chat backbone
- the MCP server exists only as a reserved internal integration boundary
- agent, tool, and model-governance areas are architectural domains, not mature product surfaces yet

## Target Architecture Direction

The long-term architecture direction remains:

```text
Experience Layer
-> Home / Chat / Documents / Agents
-> Admin / Operations / Settings entry through the global avatar menu
-> FastAPI API Gateway
-> Knowledge / Retrieval / Chat / Governance / Workflow / Agent services
-> Temporal durable workflows
-> Future agent runtime orchestration
-> PostgreSQL / pgvector / Elasticsearch / Redis / MinIO
-> Model Gateway -> OpenAI-compatible or private runtimes
-> OpenTelemetry
```

### Final blueprint implementation rule

Core product flows must follow the final production architecture even when the current implementation still contains development-stage shortcuts.

This applies most importantly to:

- identity and authentication
- tenant and membership governance
- authorization boundaries
- workflow durability
- agent and tool execution policy

Short-lived scaffolding may help local development, but it must stay replaceable and must not redefine the target system shape.

### Target product-surface direction

The target top-level web experience should converge toward:

- `Home`
- `Chat`
- `Documents`
- `Agents`

Global utilities should converge toward:

- `GitHub`
- `Language`
- `Theme`
- `User Avatar`

The avatar dropdown should carry:

- `Admin`
- `Operations`
- `Settings`
- `Sign out`

This keeps user-facing navigation distinct from governance and execution supervision surfaces.

## Layer Responsibilities

### Web

- Home overview
- Chat destination
- Documents destination
- Agents destination
- admin console entry
- operations console entry
- transitional directory-backed access guard for protected routes
- English and Simplified Chinese UI switching
- light and dark appearance switching
- grounded chat rendering
- document and workflow operator controls
- placeholder-friendly UI shells for unfinished but approved information architecture
- Tailwind CSS with a shadcn/ui component structure built on Radix UI primitives

Current note:

- the present login and session flow is a transitional implementation used to keep product work moving
- the final target remains production-grade authentication, session control, and RBAC aligned with the product blueprint

### API

- tenant-aware HTTP routing
- request validation
- tenant, workspace, knowledge base, document, retrieval, chat, workflow, and future agent endpoints
- workflow triggering and workflow inspection
- trace propagation

### Worker

- durable document ingestion
- document reindexing
- parsing and normalization
- chunking
- embedding generation
- vector persistence

### Retrieval

Current state:

- hybrid recall through `pgvector` vector search plus lexical chunk matching
- fused retrieval context assembly for grounded answers with deduplicated result ranking
- native rerank over a governed candidate window before the final retrieval top-k is returned
- governed retrieval profiles for runtime behavior selection
- optional `llamaindex_pilot` retrieval path behind the retrieval-engine boundary
- native-versus-pilot retrieval comparison for grounded question review

Planned expansion:

- lexical recall through `Elasticsearch`
- richer retrieval quality evaluation
- decisioning for whether the pilot retrieval path should be promoted, held, or removed

### Model Gateway

Current state:

- deterministic local provider for development
- OpenAI-compatible chat and embedding provider support
- native `Ollama` chat provider support

Planned expansion:

- broader provider routing
- retries, fallback, timeout, and governance controls
- optional higher-throughput private inference through `vLLM`

### Agent Runtime

Current state:

- persisted agent definitions, launches, and execution records
- governed model endpoint and tool bindings
- readiness and governance issue review
- bounded `langgraph_pilot` runtime path for workflow recovery
- no mandatory agent framework is required for the default runtime path

Planned expansion:

- broader step traces
- tool policy enforcement
- approval-aware task execution
- broader optional orchestration through the existing `langgraph_pilot` boundary when a real agent lane needs it
- explicit coexistence with Temporal, where Temporal owns durable business workflows and agent orchestration remains separate

### Observability

Current state:

- OpenTelemetry collector in local infrastructure

Planned expansion:

- stronger trace coverage
- structured metrics and logs
- richer audit and operational visibility

### MCP Boundary

Current state:

- internal placeholder service boundary only

Planned expansion:

- controlled tool exposure
- auditable agent-facing integrations
- admin-facing `Tools` or `Integrations` management, not top-level navigation exposure

## Current Delivered Product Surfaces

### Home

- platform homepage with formal product positioning
- active tenant, workspace, and knowledge base scope selection
- high-level platform readiness signals
- direct entry into built product surfaces without duplicating admin workflows
- concise live activity signals for recent conversation and failure awareness

### Workspace

- protected entry with login return-to support
- grounded chat with citations
- conversation history
- documents view
- workflows view
- document search, filter, pagination, and batch actions
- workflow retry and inspection

### Admin

- protected entry with login return-to support
- local role-aware gate for admin access
- tenant scope selection
- workspace lifecycle filtering
- knowledge base publication filtering
- cross-resource search

### Settings

- protected entry with login return-to support
- local session profile editing
- role-aware access preview for the current and pending local session
- global language switching between English and Simplified Chinese
- global light and dark appearance switching
- visibility into the configured local API base URL and repository shortcut when present

## Target Surface Evolution

The current `Workspace` route is still a real delivered surface, but it should evolve toward clearer first-level destinations:

- `Chat` should own conversation and citation experiences
- `Documents` should own document operations and document-context workflow visibility
- `Agents` may begin as a structured UI shell before its runtime is fully mature
- `Operations` should absorb deeper workflow supervision instead of leaving `Workflows` as a permanent first-level destination
- `Admin` should remain the governance and control plane entry

This evolution should improve product clarity without breaking the already working end-to-end path.

## Delivery Strategy

### Implemented path

- local infrastructure and runtime boundaries
- tenant, workspace, and knowledge base management
- document upload and ingestion
- retrieval-backed chat with citations
- workflow visibility and retry
- operator and admin console foundations

### Next architecture focus

- stabilize the top-level navigation and surface boundaries
- replace the transitional login path with production authentication, session control, and RBAC
- parser coverage expansion
- retrieval quality evaluation and rerank
- close existing `LlamaIndex` and `LangGraph` pilot paths only through real product-chain validation
- stronger admin and audit surfaces
- production hardening
