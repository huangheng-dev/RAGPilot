# RAGPilot Naming Conventions

## Principle

RAGPilot uses a clean naming system defined for this repository only. It does not inherit naming from any legacy PHP or third-party RAG project.

## Database Tables

Use `snake_case` and plural nouns for tables.

Current examples (the complete implemented inventory is maintained in [`platform-data-model.md`](./platform-data-model.md)):

- `tenants`
- `users`
- `workspaces`
- `knowledge_bases`
- `documents`
- `document_versions`
- `document_chunks`
- `conversations`
- `messages`
- `message_citations`
- `agent_runs`
- `agent_executions`
- `agent_approval_requests`
- `tool_registrations`
- `workflow_runs`
- `model_endpoints`
- `retrieval_profiles`
- `retrieval_evaluations`
- `message_feedback_entries`
- `runtime_governance_events`

## Database Columns

Use `snake_case`.

Primary and foreign key rules:

- primary key: `id`
- foreign keys: `<entity>_id`
- timestamps: `created_at`, `updated_at`, `deleted_at`
- status fields: `status`
- booleans: `is_active`, `is_archived`, `is_public`

Avoid generic legacy columns such as:

- `run`
- `flag`
- `num`
- `data`

Prefer explicit names such as:

- `ingestion_status`
- `chunk_count`
- `payload_json`

## Python Package Layout

Use clear package roots and layered names.

Recommended structure:

```text
apps/api/ragpilot_api/
  application/
  domain/
  infrastructure/
  presentation/
  contracts/
```

Rules:

- package names: `snake_case`
- class names: `PascalCase`
- function names: `snake_case`
- constants: `UPPER_SNAKE_CASE`

## Python File Names

File names should describe role and domain.

Good examples:

- `knowledge_base_service.py`
- `document_repository.py`
- `chat_routes.py`
- `model_gateway.py`
- `retrieval_pipeline.py`
- `document_ingestion_workflow.py`
- `document_ingestion_activity.py`

Avoid vague names such as:

- `common.py`
- `base.py`
- `utils.py`
- `index.py`
- `service.py`

## Method Names

Method names should use a verb plus domain intent.

Good examples:

- `create_conversation`
- `list_documents`
- `start_document_ingestion`
- `build_retrieval_context`
- `route_chat_model`
- `record_tool_call`

Avoid legacy-style controller names such as:

- `getList`
- `uploadFile`
- `parseDocument`
- `checkStatus`

## Frontend Naming

Use:

- route folders: `kebab-case`
- component files: `PascalCase.tsx`
- hooks: `use_<domain>.ts` is not required; prefer `use-domain.ts` file names with exported camelCase hooks
- server actions and helpers: `snake_case` file names are not required in TypeScript; prefer `kebab-case`

Examples:

- `app/knowledge-bases/page.tsx`
- `components/chat/ConversationPanel.tsx`
- `lib/api-client.ts`
- `lib/streaming/sse-client.ts`

## Documentation Naming

Documentation should follow a small, predictable taxonomy.

Folder rules:

- use lowercase folder names only
- top-level documentation folders should describe documentation purpose, not implementation language
- keep documentation categories stable

Current approved documentation folders:

- `docs/product`
- `docs/architecture`
- `docs/runbooks`

Markdown file rules:

- use `kebab-case.md`
- use explicit domain-first names
- prefer `<domain>-<purpose>.md`
- avoid vague names such as `notes.md`, `temp.md`, `misc.md`, or `draft.md`

Good examples:

- `project-blueprint.md`
- `project-snapshot.md`
- `system-overview.md`
- `repository-structure.md`
- `local-development.md`

Documentation placement rules:

- product direction belongs in `docs/product`
- implementation and system decisions belong in `docs/architecture`
- operational steps and environment procedures belong in `docs/runbooks`

When adding a new markdown file, choose the folder first, then choose a precise `kebab-case` file name.

## API Paths

Use resource-oriented nouns and clear verbs only when required by workflow semantics.

Examples:

- `GET /api/v1/knowledge-bases`
- `POST /api/v1/documents`
- `POST /api/v1/workflows/document-ingestion`
- `GET /api/v1/agent-runs/{run_id}`

## Summary

RAGPilot naming will follow:

- domain-first names
- explicit status fields
- plural table names
- resource-oriented API paths
- verb-based service methods
- no carry-over from legacy project naming
