# RagPilot Project Blueprint

## Purpose

RagPilot is an English-first, production-grade, open-source AI knowledge platform. It is designed to help teams build, operate, evaluate, and extend retrieval-augmented AI systems with clear product boundaries, durable workflows, observable infrastructure, and professional naming.

This blueprint is the product and engineering reference for future implementation. When there is uncertainty, new work should align with this document before introducing new concepts, modules, names, or workflows.

Repository placement rules are maintained in [Repository Structure](../architecture/repository-structure.md).

## Current Product Direction

RagPilot is currently being implemented as an open-source knowledge operations platform with a strong administrator and operator workflow, not as a consumer chat product.

The near-term product direction is:

- establish a stable administrator console inside the main web application
- make tenants, workspaces, and knowledge bases first-class managed resources
- make document ingestion and workflow operations visible and actionable
- keep grounded chat tightly connected to retrieval, citations, and document state
- preserve clean separation between operator workflows and future end-user assistant experiences

This means current implementation work should prioritize:

- administration and lifecycle controls
- document and workflow operations
- retrieval-backed chat with citations
- durable ingestion and reindex behavior
- explicit status visibility across managed resources

This also means work should not drift into:

- marketing-style landing pages
- consumer-first social chat patterns
- agent-heavy abstractions before the RAG operations path is stable
- unrelated feature experiments that do not strengthen the core platform path

## Product Simplification Rule

RagPilot must remain lean, operational, and product-focused.

This rule is mandatory for future implementation:

- do not let the product expand into a dense collection of overlapping dashboards, boards, packets, helper layers, or experimental control surfaces
- do not keep UI modules whose primary value is explanation, decoration, or internal architecture display instead of real task completion
- do not preserve weak features just because implementation work already exists
- when a capability is real but not yet core, prefer to hide it, fold it into an existing page, or keep it internal until the main chain is stronger

The default product test for new work is:

1. does it directly support a real user or operator task?
2. does it strengthen the main `Documents -> Operations -> Chat` path, or a necessary `Admin` governance path?
3. does it reduce work or confusion instead of adding another interpretation layer?

If the answer is not clearly yes, the feature should be deferred.

### Lean Core Scope

The visible product should prioritize these core surfaces:

- `Home`: concise overview and clear entry into active work
- `Chat`: grounded answers, citations, and conversation continuity
- `Documents`: upload, ingestion, indexing, status, and lifecycle actions
- `Operations`: workflow queue visibility, failure handling, and retry supervision
- `Admin`: tenant, workspace, knowledge base, member, and access governance
- `Agents`: lean agent definition and runtime handoff only
- `Settings`: essential preferences and lightweight session/system controls only

The visible product should avoid turning these areas into separate complexity layers:

- duplicate dashboards that repeat the same status in different forms
- large governance summary walls outside the real admin workflow
- packet, board, or runbook abstractions that sit on top of existing actions without adding core task value
- placeholder modules that look important but are not backed by real product capability

### Compatibility and Deferred Surfaces

- compatibility routes may continue to exist for deep links and transition safety
- internal scaffolding may continue to exist for engineering continuity
- neither compatibility routes nor scaffolding should define the long-term visible product structure
- advanced observability, agent orchestration depth, MCP management, and similar expansion areas should stay deferred until the core product path is clean and stable

## Implementation Working Rule

During active delivery, RagPilot should be advanced in disciplined implementation batches instead of tiny fragmented edits.

Expected working rule:

- complete `3-5` meaningful progress points per implementation round when practical
- keep the current stack running during ordinary iteration
- restart services only after major changes that can affect runtime behavior or integration boundaries
- run focused validation after those major changes before starting the next round

This rule is meant to preserve momentum while protecting the real platform chain that already exists.

## Product Positioning

RagPilot is not a chat demo, a document uploader, or a thin wrapper around a model provider. It is a platform for building reliable AI knowledge systems.

RagPilot should feel like:

- a knowledge operations platform for teams
- a RAG application foundation for developers
- an AI assistant backend with auditable retrieval and citations
- a workflow-driven system for document ingestion, indexing, evaluation, and model usage

RagPilot should not become:

- a clone of any legacy PHP project
- a collection of loosely connected scripts
- a single-purpose chatbot
- a UI-only demo without durable backend behavior
- a vendor-specific wrapper tied to one model provider

## Core Principles

### English-first project language

All code, file names, database objects, API paths, documentation, commit messages, and product concepts should use clear professional English.

### Original naming system

RagPilot defines its own naming system from scratch. It must not copy table names, method names, file names, controller structures, or domain vocabulary from any legacy project.

### Production-oriented design

Every major feature should be designed with authentication, tenancy, observability, failure recovery, background processing, and deployment in mind, even if the first implementation is intentionally small.

### Final blueprint over scaffolding

Core user and operator flows must be implemented toward the final production blueprint, not toward temporary local scaffolding.

This rule means:

- transitional helpers may exist only to unblock development
- transitional helpers must stay clearly replaceable
- temporary implementation shortcuts must never become the default product contract
- future work must resolve gaps by moving code toward the blueprint, not by shrinking the blueprint to match temporary code

### Explicit domain boundaries

Knowledge management, document ingestion, retrieval, chat, model routing, workflows, agents, evaluation, and operations should remain separate domains with clear contracts.

### Traceable AI behavior

Answers should be explainable through citations, retrieval metadata, model usage records, workflow logs, and evaluation results.

### Open-source maintainability

The repository should be understandable to external contributors. Prefer explicit names, documented architecture, small modules, typed contracts, and predictable folder structure.

## Target Users

### Platform administrators

They manage tenants, users, roles, API keys, model providers, storage, audit logs, usage, and system configuration.

### Knowledge operators

They create knowledge bases, upload documents, monitor ingestion, review indexing status, and maintain document quality.

### End users

They ask questions, receive grounded answers, inspect citations, continue conversations, and provide feedback.

### Developers

They extend retrieval pipelines, add model providers, register tools, define agents, create integrations, and deploy RagPilot in different environments.

## Product Domains

### 1. Identity and Tenancy

RagPilot should support teams and organizations from the beginning.

Core capabilities:

- tenants
- users
- tenant memberships
- roles and permissions
- API keys
- audit logs

Expected outcomes:

- isolate data by tenant
- support future enterprise administration
- provide a clean foundation for access control
- allow service-to-service access through API keys

Initial implementation should be simple but structurally compatible with multi-tenant production use.

Authentication and session direction:

- final RagPilot authentication must be production-grade rather than browser-local simulation
- membership activation, session validity, sign-out, and protected-route behavior must resolve through formal backend-controlled auth contracts
- local development helpers may temporarily assist implementation, but they are not the target identity architecture

### 2. Workspaces and Knowledge Bases

Workspaces organize user-facing collaboration. Knowledge bases organize retrieval-ready content.

Core capabilities:

- create and manage workspaces
- create and manage knowledge bases
- connect data sources
- manage knowledge base memberships
- track knowledge base status and metadata

Expected outcomes:

- users can separate different projects, teams, or use cases
- retrieval can be scoped to selected knowledge bases
- future permissions can be applied at workspace and knowledge base levels

### 3. Document Management

Documents are the source material for knowledge bases.

Core capabilities:

- upload documents
- store original assets in object storage
- create document versions
- track ingestion status
- track indexing status
- view extracted chunks
- archive or delete documents

Supported document types can start small and expand over time.

Initial priority:

- PDF
- Markdown
- plain text
- common office documents when parsing support is available

Expected outcomes:

- every uploaded document has a durable record
- every document version can be traced to parsing and indexing results
- ingestion failures are visible and recoverable

### 4. Ingestion Workflows

Document ingestion must be durable and observable. Temporal should manage long-running workflows.

Core workflow stages:

1. receive document upload
2. persist document asset
3. create document version
4. extract document content
5. normalize text
6. split content into chunks
7. generate embeddings
8. write vector records
9. write lexical index records
10. update ingestion and indexing statuses

Core capabilities:

- retry failed activities
- resume or re-run ingestion
- reindex a knowledge base
- inspect workflow runs and workflow steps
- record parsing errors and indexing errors

Expected outcomes:

- background work is not hidden inside API requests
- failed ingestion can be diagnosed
- indexing state remains consistent with document state

### 5. Retrieval

Retrieval is the core intelligence layer between knowledge bases and model responses.

Core capabilities:

- vector recall through pgvector
- lexical recall through Elasticsearch
- metadata filtering
- result merging
- deduplication
- reranking
- context assembly
- retrieval profiles

Initial implementation can start with vector recall only, but the contracts should anticipate hybrid retrieval.

Expected outcomes:

- retrieval behavior can be configured per use case
- generated answers can cite specific document chunks
- retrieval quality can be evaluated and improved independently from chat UI work

Technology direction:

- the current retrieval core should remain self-managed inside RagPilot services
- `LlamaIndex` is a future retrieval enhancement candidate, not a current mandatory dependency
- if adopted later, `LlamaIndex` should enhance retrieval orchestration inside the retrieval domain rather than replace the platform architecture
- early implementation should stay compatible with future hybrid retrieval, rerank, and multi-source retrieval composition
- project documentation should list only technologies that are actually implemented or explicitly approved for future evaluation inside RagPilot

### 6. Chat and Citations

Chat is the primary end-user experience.

Core capabilities:

- create conversations
- send user messages
- stream assistant responses
- retrieve relevant context
- generate grounded answers
- attach citations to responses
- store message feedback
- list conversation history

Expected outcomes:

- users can ask questions against selected knowledge bases
- answers include visible source references
- conversations are persisted and auditable
- user feedback can inform future evaluation

### 7. Model Gateway

The model gateway abstracts model providers and deployment choices.

Core capabilities:

- register model providers
- register model deployments
- define model routing policies
- support OpenAI-compatible APIs
- support local or private inference such as vLLM
- handle retries, fallback, timeouts, and usage recording

Expected outcomes:

- RagPilot is not locked to one provider
- hosted and self-hosted models can share a common interface
- model usage can be tracked for cost, latency, and reliability

Technology direction:

- the model gateway should remain provider-agnostic
- OpenAI-compatible providers are part of the current architecture path
- native `Ollama` routing is now part of the current architecture path for local and self-hosted usage
- `vLLM` is a valid future private-inference runtime option for higher-throughput deployments
- future runtime additions should be integrated through the model gateway instead of leaking provider-specific behavior into product surfaces

### 8. Agents and Tools

Agents extend RagPilot beyond retrieval-only conversations.

Core capabilities:

- agent definitions
- agent runs
- agent steps
- tool registrations
- tool calls
- MCP server integration
- long-running agent jobs

Agents should be introduced after the core RAG path is stable. The first version should avoid overcomplicated agent abstractions.

Expected outcomes:

- tools can be registered and called through controlled interfaces
- agent behavior can be traced step by step
- future workflows can combine retrieval, reasoning, and external actions

Technology direction:

- the current platform should not depend on a full agent framework before the core RAG path is stable
- `LangGraph` is a future agent orchestration candidate, not a current mandatory dependency
- if adopted later, `LangGraph` should live inside the agent runtime layer and should not replace Temporal-based durable business workflows
- the first agent implementations should favor explicit task boundaries, tool policies, approvals, and auditability over open-ended autonomous behavior

### 9. Evaluation

Evaluation protects quality as retrieval, prompts, and models evolve.

Core capabilities:

- evaluation datasets
- evaluation runs
- evaluation items
- retrieval quality checks
- answer quality checks
- citation quality checks
- regression tracking

Expected outcomes:

- changes to retrieval and prompts can be tested
- model migrations can be compared
- quality becomes measurable instead of anecdotal

### 10. Observability and Operations

RagPilot should expose what the system is doing and why.

Core capabilities:

- OpenTelemetry traces
- structured logs
- metrics for latency, errors, throughput, and usage
- audit logs
- workflow status views
- usage records

Expected outcomes:

- API, retrieval, workflow, and model calls can be traced
- production issues can be diagnosed
- administrators can understand system health and usage

## Application Surfaces

### Web Console

The web console is the primary human interface.

The web console should follow a clear product navigation hierarchy instead of exposing every operational surface at the same level.

#### Primary navigation

The approved first-level navigation is:

- `Home`
- `Chat`
- `Documents`
- `Agents`

These destinations represent the user-facing product shape:

- `Home` is the platform overview and quick-entry workspace
- `Chat` is the grounded conversation destination
- `Documents` is the knowledge-asset and document-operations destination
- `Agents` is the future-facing intelligent task destination and may begin as a structured UI shell before its runtime is fully mature

#### Global utilities

Top-right global controls should include:

- `GitHub`
- `Language`
- `Theme`
- `User Avatar`

#### Avatar dropdown

The avatar dropdown should expose:

- `Admin`
- `Operations`
- `Settings`
- `Sign out`

#### Surface rules

- first-level navigation should stay focused on user goals, not backend subsystems
- forms for create and edit flows should prefer modal or drawer presentation instead of permanently expanded page sections when that improves readability
- unfinished product areas may use explicit UI placeholders when they preserve the intended architecture and do not misrepresent missing runtime capability
- `Workflows` should not remain a permanent first-level navigation destination for all users
- workflow supervision should increasingly live inside `Operations` or inside document-context workflow detail views
- `MCP` should not appear as a first-level navigation destination

#### Planned page groups

`Home` should grow around:

- an operating-architecture overview that explains the live platform path from governance to knowledge, execution, answers, and agent extension
- workspace overview
- recent conversations
- recent documents
- knowledge base summary
- activity metrics
- quick actions

`Chat` should grow around:

- conversation list
- conversation detail
- citation panel
- scope context
- conversation search
- new conversation

`Documents` should grow around:

- document registry
- upload center
- document detail
- version history
- processing status
- reindex actions
- archive and delete actions
- knowledge base assignment

`Agents` should grow around:

- agent directory
- agent detail
- explicit operating lanes for grounded chat, document intake, workflow recovery, and governance review
- agent runs
- agent templates
- agent knowledge scope
- agent model binding
- agent tool binding
- agent approval policy
- agent output history

### Admin Console

The admin console is the operational management surface for platform administrators. It may initially live inside the same Next.js web application as protected admin routes, but its product boundary should remain distinct from the end-user knowledge and chat experience.

Core capabilities:

- tenant management
- user management
- role and permission management
- API key management
- workspace and knowledge base administration
- document and ingestion oversight
- model provider and model deployment configuration
- retrieval profile configuration
- workflow run monitoring
- audit log review
- usage and quota monitoring
- system health overview

Target admin navigation:

- `Overview`
- `Directory`
- `Security`
- `Models`
- `Tools`
- `Observability`
- `Settings`

Current implementation is now moving toward this target through a clearer governance split between:

- `Overview`
- `Directory`
- `Access`

Initial admin pages:

- Admin Dashboard
- Tenants
- Users
- Roles and Permissions
- API Keys
- Knowledge Base Administration
- Workflow Runs
- Model Providers
- Audit Logs
- Usage Records

Expected outcomes:

- administrators can operate RagPilot without direct database access
- tenant and user access can be managed safely
- ingestion, model usage, and workflow failures can be inspected
- production operations have a dedicated control surface

### Operations Console

The operations console is the execution supervision surface. It should stay distinct from platform governance even when both areas live inside the same web application shell.

Target operations navigation:

- `Workflow Runs`
- `Ingestion Jobs`
- `Failed Runs`
- `Retry Queue`
- `Queue Status`
- `Activity Log`
- `Execution Detail`

Current implementation is now moving toward this target through stable execution lanes for:

- overall supervision
- failed recovery
- retry review
- queue pressure

Responsibilities:

- monitor workflow execution
- inspect ingestion state and retry history
- review failures and recovery queues
- trace operator intervention paths
- keep durable workflow behavior visible without exposing raw infrastructure internals

### Current Admin Console Scope

The current implementation direction for the admin console is intentionally operations-first.

The initial control surface should center on:

- tenant switching and creation
- workspace switching, creation, editing, and archive lifecycle
- knowledge base switching, creation, editing, and publication lifecycle
- document upload, inspection, reindex, delete, and activity history
- workflow run inspection, retry, lineage, and failure diagnosis
- grounded chat validation against the currently selected knowledge base

This scope should be treated as the active working baseline for the current stage of development.

### API Service

The API service is the main backend gateway.

Responsibilities:

- authentication and session validation
- tenant isolation
- request validation
- resource APIs
- chat orchestration
- retrieval orchestration
- workflow triggering
- trace propagation

### Worker Service

The worker service handles durable background work.

Responsibilities:

- document ingestion workflows
- document parsing activities
- chunking activities
- embedding activities
- indexing activities
- reindex workflows
- background evaluation jobs

### MCP Server

The MCP server is a reserved internal integration boundary for controlled tool exposure. It is part of the platform architecture, but it is not a current user-facing navigation surface.

Responsibilities:

- register RagPilot tools
- expose knowledge and retrieval capabilities to compatible clients
- support future agent tool calls
- keep tool boundaries explicit and auditable

Current boundary rules:

- MCP should remain decoupled from the primary web navigation
- unfinished MCP functionality should not be presented as completed user-facing product capability
- future product exposure should happen under admin-facing `Tools` or `Integrations`
- MCP should be able to evolve independently without forcing a redesign of the core chat, documents, or workflow surfaces

## Data Model Direction

The data model should grow from a small stable core.

Initial tables:

- `users`
- `tenants`
- `tenant_memberships`
- `workspaces`
- `knowledge_bases`
- `documents`
- `document_versions`
- `document_assets`
- `document_chunks`
- `document_chunk_embeddings`
- `conversations`
- `messages`
- `message_citations`
- `workflow_runs`
- `workflow_steps`

Expansion tables:

- `roles`
- `permissions`
- `role_permissions`
- `api_keys`
- `data_sources`
- `conversation_participants`
- `message_feedback`
- `retrieval_profiles`
- `model_providers`
- `model_deployments`
- `model_routing_policies`
- `agent_definitions`
- `agent_runs`
- `agent_steps`
- `tool_registrations`
- `tool_calls`
- `prompt_templates`
- `prompt_versions`
- `audit_logs`
- `usage_records`
- `evaluation_runs`
- `evaluation_items`

## First Production Path

The first useful RagPilot version should complete one end-to-end path before broadening scope.

Required path:

1. create a tenant and user foundation
2. create a workspace
3. create a knowledge base
4. upload a document
5. store the document asset
6. run document ingestion through a worker workflow
7. create document chunks
8. create embeddings
9. retrieve chunks for a user question
10. generate a streaming answer
11. attach citations
12. save the conversation and messages

This path is the MVP backbone. Other features should support or extend this path, not distract from it.

## Delivery Phases

### Phase 1: Platform Foundation

Goals:

- repository structure
- Docker Compose infrastructure
- API health and configuration
- web shell
- worker shell
- naming conventions
- architecture docs
- first database migration foundation

Exit criteria:

- services start locally
- API health works
- database migration tooling is ready
- documentation explains how to run the system

### Phase 2: Knowledge Base and Document Core

Goals:

- tenant, user, workspace, and knowledge base models
- document upload API
- object storage integration
- document version records
- basic web management screens
- initial admin console routes for users, tenants, and knowledge base oversight

Exit criteria:

- a user can create a knowledge base
- a user can upload a document
- uploaded document assets are stored durably
- document status is visible
- administrators can inspect tenants, users, knowledge bases, and document status

### Phase 3: Ingestion and Vector Indexing

Goals:

- Temporal document ingestion workflow
- document parsing
- chunk generation
- embedding generation
- pgvector storage
- workflow status tracking

Exit criteria:

- uploaded documents become searchable chunks
- ingestion failures are visible
- ingestion can be retried or re-run

### Phase 4: Chat with Citations

Goals:

- conversation APIs
- retrieval pipeline
- model gateway first provider
- streaming responses
- message citations
- chat UI

Exit criteria:

- a user can ask a question against a knowledge base
- RagPilot streams an answer
- the answer includes citations
- conversation history is persisted

### Current Implementation Snapshot

At the current stage, RagPilot already has a meaningful part of the Phase 2 to Phase 4 path implemented.

Implemented foundation:

- tenant, workspace, and knowledge base management APIs
- document upload, detail, reindex, and soft delete APIs
- workflow run list, detail, retry, and lineage support
- Temporal-backed ingestion with chunk and embedding persistence
- retrieval-backed chat with stored conversations, messages, and citations
- a web operator workspace with chat, documents, and workflows views
- admin-style context controls for tenant, workspace, and knowledge base selection
- resource creation, editing, archive, and publication lifecycle controls in the web console

This snapshot should guide short-term decisions:

- strengthen the admin and operator experience before broadening product scope
- finish lifecycle and management completeness for existing domains
- improve maintainability of the current web console
- expand retrieval and ingestion quality after the management surface is stable

### Phase 5: Hybrid Retrieval and Quality

Goals:

- Elasticsearch lexical recall
- hybrid merge and deduplication
- rerank support
- retrieval profiles
- message feedback
- evaluation runs

Exit criteria:

- retrieval behavior is configurable
- quality can be measured with evaluation runs
- feedback is captured for future improvement

### Phase 6: Model Governance and Agent Workflows

Goals:

- model providers
- model deployments
- routing policies
- agent definitions
- tool registrations
- MCP integration
- agent run tracing
- admin console pages for model governance and agent operations

Exit criteria:

- multiple model providers can be configured
- tool calls are traceable
- simple agent workflows can run safely
- administrators can configure providers and inspect agent runs from the admin console

## Non-goals for Early Versions

Avoid these until the core RAG path is stable:

- complex no-code workflow builders
- marketplace-style plugin systems
- advanced agent autonomy
- fine-tuning management
- full enterprise SSO
- billing systems
- visual data labeling tools
- heavy analytics dashboards

These may become valid later, but they should not shape the first implementation.

## Naming Guardrails

All new implementation should follow the existing naming conventions:

- tables: `snake_case` plural nouns
- columns: explicit `snake_case`
- Python packages and functions: `snake_case`
- Python classes: `PascalCase`
- TypeScript components: `PascalCase`
- frontend route folders: `kebab-case`
- API paths: resource-oriented nouns
- service methods: verb-based domain intent

Avoid vague names:

- `common`
- `base`
- `utils`
- `data`
- `info`
- `run`
- `flag`
- `handler`

Prefer explicit names:

- `knowledge_base_service`
- `document_ingestion_workflow`
- `conversation_repository`
- `retrieval_pipeline`
- `model_gateway`
- `workflow_status`
- `ingestion_status`
- `message_citations`

## Decision Rules

When adding a feature, ask:

1. Does it support the first production path or a documented delivery phase?
2. Does it belong to a clear product domain?
3. Is the name original, English-first, and professional?
4. Can it be tested or observed?
5. Does it preserve tenant isolation?
6. Does it keep retrieval, chat, workflows, and model access separated?
7. Does it avoid copying legacy project concepts or structures?
8. Does it move the implementation closer to the final blueprint instead of preserving a temporary shortcut?

If the answer is unclear, document the decision before implementing.

## Success Definition

RagPilot succeeds when it can be deployed by another team and used to operate a real AI knowledge system:

- documents are ingested reliably
- retrieval is explainable
- answers include citations
- workflows are observable
- models are configurable
- quality can be evaluated
- the codebase remains understandable and extensible
