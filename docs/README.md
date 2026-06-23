# RagPilot Documentation Index

## Purpose

This index defines the stable documentation structure for RagPilot and points contributors to the current source-of-truth markdown files.

The goals are:

- keep markdown files organized
- keep folder names stable
- make new documentation easy to place correctly
- prevent product direction and implementation notes from scattering

## Folder Structure

```text
docs/
  api/
  architecture/
  internal/        # optional private local-only notes, not for public GitHub by default
  planning/
  private/         # optional private local-only notes, not for public GitHub by default
  product/
  runbooks/
  templates/
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
- `platform-blueprint-reference.md`
- `project-snapshot.md`
- `technology-rollout.md`

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

- `phase-5-release-checklist.md`
- `progress-flow.md`
- `roadmap.md`

### `docs/runbooks`

Use for:

- local setup
- operational procedures
- maintenance instructions
- troubleshooting

Current files:

- `first-tagged-release-checklist.md`
- `local-development.md`
- `github-publish-preparation.md`
- `first-public-release.md`

### `docs/templates`

Use for:

- reusable documentation standards
- baseline template packs
- future documentation scaffolding

Current files:

- `documentation-standard/`

## Current Coverage

The current documentation set reflects the live implementation state of RagPilot, including:

- Home, Workspace, and Admin web surfaces
- the agreed target navigation direction of `Home`, `Chat`, `Documents`, and `Agents`
- tenant, workspace, and knowledge base management
- document ingestion and reindex behavior
- document filtering, pagination, and batch operations
- workflow visibility and retryability
- the distinction between user-facing destinations and avatar-menu governance surfaces
- the reserved internal MCP integration boundary
- current local ports and Docker-based startup flow
- the one-technology-at-a-time rollout rule and the main-chain progress flow

## Markdown Naming Rules

All markdown files should follow these rules:

- use lowercase only
- use `kebab-case`
- use explicit names
- keep names domain-first when possible

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
3. [Progress Flow](./planning/progress-flow.md)
4. [Technology Rollout](./product/technology-rollout.md)
5. [Roadmap](./planning/roadmap.md)
6. [API Outline](./api/api-outline.md)
7. [Local Development Runbook](./runbooks/local-development.md)
8. [GitHub Publish Preparation](./runbooks/github-publish-preparation.md)
9. [Phase 5 Release Checklist](./planning/phase-5-release-checklist.md)
10. [First Public Release Runbook](./runbooks/first-public-release.md)
11. [First Tagged Release Checklist](./runbooks/first-tagged-release-checklist.md)

Use these when reviewing system boundaries:

- [System Overview](./architecture/system-overview.md)
- [Repository Structure](./architecture/repository-structure.md)
- [Naming Conventions](./architecture/naming-conventions.md)
- [Platform Data Model](./architecture/platform-data-model.md)
