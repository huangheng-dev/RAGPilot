# RAGPilot Documentation Index

Language: English | [简体中文](./README.zh-CN.md)

## Purpose

This index defines the stable project documentation structure for RAGPilot and points contributors and operators to the versioned source-of-truth documents maintained with the codebase.

The goals are:

- keep markdown files organized
- keep folder names stable
- make new documentation easy to place correctly
- prevent product direction and implementation notes from scattering

Documentation authority is intentionally narrow:

- `product/project-blueprint.md` owns target architecture and durable boundaries
- `product/project-snapshot.md` owns current implemented behavior
- `planning/roadmap.md` owns incomplete work

Publication rule:

- root-level Markdown files provide the public project overview, contribution, security, and release entry points
- `docs/` contains the public technical documentation that is versioned and reviewed with code changes
- sensitive or organization-specific material belongs only in the Git-ignored `docs/internal/` or `docs/private/` directories

## Folder Structure

```text
docs/
  api/
  architecture/
  planning/
  product/
  runbooks/
```

## Current Documentation Set

### `docs/product`

Use for:

- product direction
- scope boundaries
- implementation phases
- reference product decisions

Current files:

- `project-blueprint.md`
- `project-snapshot.md`

### `docs/architecture`

Use for:

- repository structure
- naming rules
- system design
- data model direction

Current files:

- `naming-conventions.md`
- `platform-data-model.md`
- `repository-structure.md`
- `system-overview.md`

### `docs/api`

Use for:

- HTTP API outlines
- endpoint group references
- contract-level summaries
- integration-facing API notes

Current files:

- `api-outline.md`

### `docs/planning`

Use for:

- roadmap documents
- near-term delivery priorities
- phase tracking
- sequencing notes

Current files:

- `roadmap.md`

### `docs/runbooks`

Use for:

- local setup
- operational procedures
- maintenance instructions
- troubleshooting

Current files:

- `local-development.md`
- `production-reliability.md`

## Current Coverage

The documentation set covers the live RAGPilot platform at different authority levels:

- delivered Home, Chat, Documents, Agents, Access Control, Operations, Settings, Admin, Login, and compatibility Workspace surfaces;
- tenant, Workspace, Knowledge Base, Data Source, Document, access, retrieval, Chat, Workflow, Agent, model, Tool, MCP, Prompt, and API-key contracts;
- durable ingestion, incremental source synchronization, search projection, Agent execution, approval, cancellation, retry, and replay behavior;
- Docker, Kubernetes, observability, migration, local development, reliability, and release-validation operations;
- explicit separation of target architecture, implemented behavior, and incomplete work.

The root README is the public introduction, not a second technical specification. Route and table inventories remain machine-checked against code in their owning documents.

## Markdown Naming Rules

All markdown files should follow these rules:

- use lowercase only
- use `kebab-case`
- use explicit names
- keep names domain-first when possible
- keep root and folder-level `README` language index files as the only naming exception

Preferred patterns:

- `<domain>-blueprint.md`
- `<domain>-reference.md`
- `<domain>-overview.md`
- `<domain>-structure.md`
- `<scope>-development.md`

Avoid:

- `notes.md`
- `misc.md`
- `temp.md`
- `draft.md`
- `new-file.md`

## Documentation Decision Rule

Before adding a markdown file:

1. decide whether it is product, architecture, API, planning, or runbook documentation
2. place it in the correct folder
3. name it with a clear `kebab-case` file name
4. link it from a higher-level index or README when it becomes durable

## Suggested Reading Order

Start here for the fastest whole-project understanding:

1. [Project Snapshot](./product/project-snapshot.md)
2. [Project Blueprint](./product/project-blueprint.md)
3. [Roadmap](./planning/roadmap.md)
4. [System Overview](./architecture/system-overview.md)
5. [API Outline](./api/api-outline.md)
6. [Platform Data Model](./architecture/platform-data-model.md)
7. [Local Development Runbook](./runbooks/local-development.md)
8. [Production Reliability Runbook](./runbooks/production-reliability.md)

Use these when reviewing system boundaries:

- [Repository Structure](./architecture/repository-structure.md)
- [Naming Conventions](./architecture/naming-conventions.md)
