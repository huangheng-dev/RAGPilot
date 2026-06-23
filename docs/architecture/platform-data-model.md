# RagPilot Platform Data Model

## Rule Set

RagPilot is English-first across schema, code, and APIs.

- tables use `snake_case` plural nouns
- columns use `snake_case`
- models use `PascalCase`
- Python methods use `snake_case`
- TypeScript components use `PascalCase`
- route folders use `kebab-case`

## Core Tables

### Identity and tenancy

- `tenants`
- `tenant_memberships`
- `users`
- `roles`
- `permissions`
- `role_permissions`
- `api_keys`

Current RBAC status:

- `roles`, `permissions`, and `role_permissions` are implemented as the database-backed policy foundation
- current permission snapshots and protected-route checks now prefer database-backed policy grants
- the centralized code-level access policy remains the fallback seed contract so capability names stay stable while production auth is still unfinished

### Workspaces and knowledge

- `workspaces`
- `knowledge_bases`
- `knowledge_base_memberships`
- `data_sources`
- `documents`
- `document_versions`
- `document_assets`
- `document_chunks`
- `document_chunk_embeddings`

### Chat and citations

- `conversations`
- `conversation_participants`
- `messages`
- `message_citations`
- `message_feedback`

### Agents and tools

- `agent_definitions`
- `agent_runs`
- `agent_steps`
- `tool_registrations`
- `tool_calls`

### Retrieval and model governance

- `retrieval_profiles`
- `model_providers`
- `model_deployments`
- `model_routing_policies`
- `prompt_templates`
- `prompt_versions`

### Workflows and operations

- `workflow_runs`
- `workflow_steps`
- `background_jobs`
- `audit_logs`
- `usage_records`
- `evaluation_runs`
- `evaluation_items`

## Preferred Status Columns

Use explicit status names by domain, for example:

- `ingestion_status`
- `indexing_status`
- `workflow_status`
- `run_status`
- `publication_status`

Avoid ambiguous names such as:

- `run`
- `state_flag`
- `type_value`

## File Naming Patterns

### API service

- `knowledge_base_routes.py`
- `document_ingestion_service.py`
- `conversation_repository.py`
- `model_gateway.py`
- `retrieval_pipeline.py`

### Worker service

- `document_ingestion_workflow.py`
- `knowledge_reindex_workflow.py`
- `document_parser_activity.py`
- `embedding_writer_activity.py`

### Frontend

- `KnowledgeBaseList.tsx`
- `ConversationWorkspace.tsx`
- `CitationDrawer.tsx`
- `api-client.ts`
- `document-upload.ts`

## Method Naming Patterns

Prefer:

- `create_knowledge_base`
- `publish_document_version`
- `start_document_ingestion`
- `list_conversation_messages`
- `assemble_retrieval_context`
- `select_chat_model`
- `record_usage_metrics`

Avoid:

- `getList`
- `saveData`
- `parseFile`
- `doRun`
- `handleInfo`

## Next Schema Candidate

The first implementation pass should likely build these tables first:

- `users`
- `tenants`
- `workspaces`
- `knowledge_bases`
- `documents`
- `document_versions`
- `document_chunks`
- `conversations`
- `messages`
- `message_citations`
- `workflow_runs`
