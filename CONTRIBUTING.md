# Contributing to RagPilot

## Purpose

This guide keeps RagPilot contribution work aligned with the actual product direction.

RagPilot is an open-source, production-oriented AI knowledge operations platform under active development.

Contributions should strengthen the main product chain instead of introducing detached demos or speculative side systems.

## Core Rules

1. keep implementation English-first
2. do not copy naming, schema, or structure from legacy PHP projects
3. prefer explicit domain naming over vague utility naming
4. land work through real product surfaces, API contracts, and persistence boundaries
5. update durable markdown when a major capability or direction changes

## Main Product Chain

Contributions should reinforce this path:

```text
Identity
-> Tenant and workspace scope
-> Knowledge base and retrieval posture
-> Document upload
-> Durable ingestion workflow
-> Document and workflow inspection
-> Retrieval validation
-> Grounded chat with citations
-> Agent execution or recovery support
-> Governance review and audit
```

## Naming Rules

- tables: snake_case plural nouns
- fields: explicit snake_case
- Python methods: verb-based snake_case
- Python files: explicit domain-based names
- frontend components: PascalCase
- route folders: kebab-case

See the full naming baseline in `docs/architecture/naming-conventions.md`.

## Technology Rule

Do not add a technology just because it is interesting in isolation.

A technology is considered landed only when it closes a real RagPilot loop:

1. product entry point
2. API contract
3. persistence or runtime state
4. governance visibility
5. UI feedback
6. validation path
7. documentation update

## Documentation Rule

When a major feature, workflow, or platform boundary changes, update the durable markdown that defines project direction:

- `README.md`
- `docs/product/project-snapshot.md`
- `docs/product/project-blueprint.md`
- `docs/planning/progress-flow.md`
- `docs/planning/roadmap.md`

If the change is phase-specific, also update the relevant checklist in `docs/planning/`.

## Local Development

Before opening a contribution:

1. keep local-only files out of the repository
2. use the ports defined by the project runbooks
3. verify the touched surfaces still build or test cleanly
4. avoid unrelated UI or naming churn

Start with:

- `README.md`
- `docs/runbooks/local-development.md`
- `docs/runbooks/github-publish-preparation.md`

## Pull Request Checklist

Before a contribution is merged:

1. verify the change serves the main product chain
2. verify naming follows the English-first project standard
3. verify any new UI keeps only core, necessary product actions
4. verify documentation still matches code reality
5. verify build and test commands still pass for the touched stack

## Current Boundaries

The following areas are still evolving and should be handled carefully:

- production authentication and external identity
- deeper agent business workflows
- mature MCP management
- deployment, CI/CD, and release automation hardening
- wider LlamaIndex and LangGraph adoption beyond the current pilot boundaries
