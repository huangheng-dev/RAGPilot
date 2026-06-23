# RagPilot API

This service acts as the API gateway and business boundary for the current platform.

## Current Scope

The API currently supports:

- health checks
- shared runtime configuration
- database migration foundation
- tenant APIs
- workspace APIs
- knowledge base APIs
- document APIs
- retrieval API
- chat APIs
- workflow APIs
- agent definition APIs
- model endpoint governance APIs
- tool registration governance APIs

## Current Resource APIs

- `GET /api/v1/health`
- `GET /api/v1/tenants`
- `POST /api/v1/tenants`
- `PATCH /api/v1/tenants/{tenant_id}`
- `GET /api/v1/workspaces?tenant_id={tenant_id}`
- `GET /api/v1/workspaces?tenant_id={tenant_id}&is_archived={true|false}`
- `POST /api/v1/workspaces`
- `PATCH /api/v1/workspaces/{workspace_id}?tenant_id={tenant_id}`
- `POST /api/v1/workspaces/{workspace_id}/lifecycle?tenant_id={tenant_id}`
- `GET /api/v1/knowledge-bases?workspace_id={workspace_id}`
- `GET /api/v1/knowledge-bases?workspace_id={workspace_id}&publication_status={draft|published}`
- `POST /api/v1/knowledge-bases`
- `PATCH /api/v1/knowledge-bases/{knowledge_base_id}?workspace_id={workspace_id}`
- `POST /api/v1/knowledge-bases/{knowledge_base_id}/publication?workspace_id={workspace_id}`
- `GET /api/v1/documents?knowledge_base_id={knowledge_base_id}`
- `GET /api/v1/documents/metrics?knowledge_base_id={knowledge_base_id}`
- `GET /api/v1/documents/{document_id}?knowledge_base_id={knowledge_base_id}`
- `POST /api/v1/documents/upload`
- `POST /api/v1/documents/{document_id}/reindex?knowledge_base_id={knowledge_base_id}`
- `DELETE /api/v1/documents/{document_id}?knowledge_base_id={knowledge_base_id}`
- `POST /api/v1/retrieve`
- `POST /api/v1/retrieve/compare`
- `GET /api/v1/chat/conversations?tenant_id={tenant_id}&workspace_id={workspace_id}`
- `GET /api/v1/chat/conversations?tenant_id={tenant_id}&workspace_id={workspace_id}&query={title_fragment}`
- `GET /api/v1/chat/conversations?tenant_id={tenant_id}&workspace_id={workspace_id}&limit={count}`
- `GET /api/v1/chat/conversations/metrics?tenant_id={tenant_id}&workspace_id={workspace_id}`
- `POST /api/v1/chat/conversations`
- `PATCH /api/v1/chat/conversations/{conversation_id}?tenant_id={tenant_id}`
- `DELETE /api/v1/chat/conversations/{conversation_id}?tenant_id={tenant_id}`
- `GET /api/v1/chat/messages?tenant_id={tenant_id}&conversation_id={conversation_id}`
- `POST /api/v1/chat/messages`
- `GET /api/v1/workflow-runs?tenant_id={tenant_id}`
- `GET /api/v1/workflow-runs/metrics?tenant_id={tenant_id}`
- `GET /api/v1/workflow-runs/{workflow_run_id}?tenant_id={tenant_id}`
- `POST /api/v1/workflow-runs/{workflow_run_id}/retry?tenant_id={tenant_id}`
- `GET /api/v1/agents?tenant_id={tenant_id}`
- `POST /api/v1/agents`
- `PATCH /api/v1/agents/{agent_definition_id}?tenant_id={tenant_id}`
- `DELETE /api/v1/agents/{agent_definition_id}?tenant_id={tenant_id}`
- `GET /api/v1/model-endpoints`
- `POST /api/v1/model-endpoints`
- `PATCH /api/v1/model-endpoints/{model_endpoint_id}`
- `DELETE /api/v1/model-endpoints/{model_endpoint_id}`
- `GET /api/v1/tool-registrations`
- `POST /api/v1/tool-registrations`
- `PATCH /api/v1/tool-registrations/{tool_registration_id}`
- `DELETE /api/v1/tool-registrations/{tool_registration_id}`

## Current API Behaviors

Document list supports:

- search
- status filtering
- sorting
- pagination

Workflow list supports:

- search
- status filtering
- workflow type filtering
- retry-mode filtering for original runs versus retry runs
- sorting
- pagination

Workflow metrics now also expose:

- `queued_runs`
- `running_runs`
- `retry_runs`

Chat conversation APIs now also expose a summary metrics endpoint so the web console can render tenant-level and workspace-level conversation activity without scraping conversation lists client-side.

Conversation deletion is handled through the chat API and removes the persisted conversation together with its stored messages and citations inside the tenant scope.

Conversation listing now also supports title search, limit controls, and recent-activity ordering so operator surfaces can keep active threads at the top.

Conversation list payloads now also include:

- `message_count`
- `latest_activity_at`

Implicit chat-created conversations now receive cleaner default titles derived from the first user prompt, which keeps workspace history easier to scan.

Both list endpoints expose browser-readable paging headers:

- `X-Total-Count`
- `X-Limit`
- `X-Offset`
- `X-Result-Count`

The current web console uses the single-document reindex and delete endpoints to drive batch document operations client-side.

Uploaded documents create a database workflow run and attempt to start a Temporal `document_ingestion` workflow path.

The retrieval API now also supports structured engine comparison through `POST /api/v1/retrieve/compare`, which compares a baseline engine such as `native` against a candidate such as `llamaindex_pilot` and returns overlap diagnostics, per-engine method breakdowns, and top-result agreement.

Model-endpoint governance APIs currently persist:

- provider type
- provider base URL
- model name
- credential delivery posture
- chat and embedding capability flags
- default-route designation

Tool-registration governance APIs currently persist:

- transport type
- surface ownership
- callable endpoint reference
- free-form capability tags
- admin-approval requirement
- enabled posture

Agent-definition APIs now also persist:

- execution mode and activation state
- scoped knowledge-base boundary
- page-surface tool bindings
- governed model-endpoint binding
- governed tool-registration bindings

## Database Migrations

Alembic migrations live in `migrations/`.

Run migrations from `apps/api`:

```bash
alembic upgrade head
```

When running Alembic from the host machine against the Docker Compose database, override the database host and port:

```powershell
$env:POSTGRES_HOST='localhost'
$env:POSTGRES_PORT='5433'
alembic upgrade head
```

## Naming Direction

The API uses English-first, domain-oriented naming:

- package root: `ragpilot_api`
- route modules: `*_routes.py`
- DTO contracts: `*_contracts.py`
- application services: `*_service.py`
- shared runtime configuration: `shared/settings.py`

## Not Yet Complete

The API is not yet complete in:

- authentication
- RBAC
- user administration
- audit and usage APIs
- production secret management for governed model endpoints
- advanced model routing and evaluation
- mature MCP and agent management APIs
