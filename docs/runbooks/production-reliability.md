# Production Reliability Runbook

## Production decisions

- authentication mode: `password_local`, backed by Argon2 password hashes, persisted bearer sessions, membership activation/suspension checks, database RBAC capability policy, lockout, revocation, and session governance
- secret delivery: External Secrets refreshes `ragpilot-secrets` hourly from `ragpilot/production`; application runtime credentials remain AES-GCM encrypted with versioned rotation
- ownership: `platform-oncall` owns API, capacity, backup and restore; `workflow-oncall` owns Temporal workers; `ai-runtime-oncall` owns model, retrieval and MCP dependencies

## SLOs

| Signal | Objective | Alert |
| --- | --- | --- |
| API availability | 99.9% monthly | 5xx ratio above 5% for 10 minutes |
| Interactive latency | p95 below 2 seconds, excluding long model generation | p95 above 2 seconds for 10 minutes |
| Projection freshness | below 5 minutes | lag above 300 seconds for 10 minutes |
| Workflow reliability | fewer than 10 retries per 15 minutes | sustained retry alert |
| Restore readiness | successful drill every 30 days | missed drill is a release blocker |

## API errors

Inspect traces by request ID, then split application failures from PostgreSQL, Redis, Temporal, Elasticsearch and model dependencies. Disable an unhealthy governed endpoint before widening fallback.

## Latency

Check HPA CPU/memory, database pool pressure, model policy admission and dependency latency. Scale before raising concurrency limits.

## Capacity

API scales between 2 and 10 replicas at 70% CPU or 75% memory. Preserve at least one API replica during voluntary disruptions. Treat 768 MiB resident memory as the investigation threshold against the 1 GiB limit.

## Worker retries

Inspect Temporal retry history and classify transient dependency errors separately from deterministic parser failures. Do not retry non-idempotent MCP tool calls automatically.

## Model runtime

Use resource health history and operator actions. Credential failures require rotation; dependency and timeout failures may use governed fallback; capability or protocol failures require configuration change.

## Backup and restore

Run `infra/scripts/backup-production.ps1`. Store the generated directory outside the cluster with its SHA-256 manifest. Run `infra/scripts/restore-drill.ps1 -BackupDirectory <path>` monthly and before a major release. The drill restores into an isolated database, validates schema and Alembic head, then removes the drill database.

## Reliability exercise

Run `infra/scripts/reliability-drill.ps1` in the staging/local production-like stack. It applies concurrent health load and pauses Elasticsearch and Redis independently, verifies API survival, and restores both dependencies.

## OCR lifecycle

PDF ingestion first uses structure-preserving page extraction. A scanned PDF with no embedded text falls back to Tesseract (`chi_sim+eng`), writes page-labelled text, and records `pdf_ocr_parser`. PNG, JPEG, WebP, TIFF, and BMP assets use the same governed OCR runtime, enforce a 40-million-pixel safety limit, and record `image_ocr_parser`. Both paths continue through the normal chunk, embedding, Outbox, rebuild, and tenant-isolation chain.

## Validation evidence — 2026-07-14

- production identity drill: 139 API tests passed across password authentication, provider-mode contracts, bearer sessions, membership lifecycle, database RBAC and credential rotation
- parser drill: 24 Worker tests passed; the deployed Worker reports Tesseract languages `chi_sim`, `eng`, and `osd`
- real OCR smoke: an image-only generated PDF selected `pdf_ocr_parser`, preserved the `Page 1 [OCR]` structure marker, and recognized the rendered validation text
- backup: PostgreSQL custom-format dump, MinIO archive, configuration snapshot and SHA-256 manifest produced successfully
- restore: isolated database restored with 35 public tables at Alembic `202607140004`, validated, then removed
- reliability: 20 concurrent health requests succeeded while Elasticsearch and Redis were paused and recovered independently
- Kubernetes manifests render successfully with HPA, PodDisruptionBudget, NetworkPolicy and hourly External Secret refresh
