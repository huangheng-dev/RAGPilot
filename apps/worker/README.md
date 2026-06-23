# RagPilot Worker

This service is reserved for durable background jobs, beginning with document ingestion workflows powered by Temporal.

## Current Behavior

The worker currently:

- receives `document_ingestion` workflow executions from the API
- updates `workflow_runs` and `workflow_steps`
- advances `documents.ingestion_status` and `documents.indexing_status`
- reads uploaded document assets from MinIO
- normalizes plain text, Markdown, HTML, CSV, JSON, PDF, DOCX, and XLSX content
- creates `document_chunks`
- generates embeddings for each chunk
- writes `document_chunk_embeddings`
- supports document reindex through the same durable ingestion path

## Current Provider Modes

Embedding providers:

- `deterministic` for local development and smoke testing
- `openai_compatible` for providers that expose `/embeddings`

## Current Gaps

The worker is not yet complete in:

- richer binary and office extraction beyond the current `PDF`, `DOCX`, and `XLSX` baseline
- richer asset extraction and structured parser pipelines
- lexical indexing activities
- evaluation workflows
- agent background jobs
