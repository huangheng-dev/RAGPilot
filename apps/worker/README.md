# RAGPilot Worker

This service is the durable background execution engine for RAGPilot workflows.

It runs Temporal-backed processing for ingestion, reindex, document state advancement, and chunk-level embedding work.

## Worker Responsibilities

The worker:

- receives `document_ingestion` workflow executions from the API
- updates `workflow_runs` and `workflow_steps`
- advances `documents.ingestion_status` and `documents.indexing_status`
- reads uploaded document assets from MinIO
- normalizes plain text, Markdown, HTML, CSV, JSON, PDF, DOCX, and XLSX content
- creates `document_chunks`
- generates embeddings for each chunk
- writes `document_chunk_embeddings`
- supports document reindex through the same durable ingestion path

## Embedding Providers

Supported embedding providers:

- `deterministic` for local development and smoke testing
- `openai_compatible` for providers that expose `/embeddings`

## Execution Boundary

The worker focuses on durable processing and state transition work that should not run in the request-response path, including:

- document ingestion lifecycle execution
- parsing and normalization
- chunk creation and embedding writes
- workflow step progression and retry-safe status updates
