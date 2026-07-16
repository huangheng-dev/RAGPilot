# RAGPilot Documentation

Language: English | [简体中文](./README.zh-CN.md)

This directory contains the public technical documentation versioned with RAGPilot. The root [README](../README.md) introduces the product; the documents here explain verified behavior, durable architecture, operating procedures, and prioritized evolution without creating competing sources of truth.

## Documentation Authority

| Document | Owns | Does not own |
| --- | --- | --- |
| [Project Snapshot](./product/project-snapshot.md) | verified product behavior and current scope | future priorities or implementation history |
| [Project Blueprint](./product/project-blueprint.md) | durable product principles and target architecture | current completion status |
| [Roadmap](./planning/roadmap.md) | prioritized engineering evolution | verified current capabilities |
| [System Overview](./architecture/system-overview.md) | realized runtime boundaries and flows | product backlog |
| [API Outline](./api/api-outline.md) | current HTTP contract groups | speculative endpoints |
| [Platform Data Model](./architecture/platform-data-model.md) | current persisted aggregates and relationships | candidate tables |
| [Changelog](../CHANGELOG.md) | release history and material changes | architecture authority |

Route and table inventories are checked against the FastAPI and SQLAlchemy contracts during release validation.

## Directory Map

| Directory | Contents |
| --- | --- |
| `product/` | product position, verified scope, and durable blueprint |
| `architecture/` | system topology, data model, repository layout, and naming rules |
| `api/` | integration-facing HTTP contract summaries |
| `planning/` | active engineering evolution and sequencing |
| `runbooks/` | local development, deployment qualification, operations, and troubleshooting |

Sensitive or organization-specific material belongs only in the Git-ignored `docs/internal/` or `docs/private/` directories.

## Reading Paths

For a project overview:

1. [Root README](../README.md)
2. [Project Snapshot](./product/project-snapshot.md)
3. [System Overview](./architecture/system-overview.md)

For architecture and extension work:

1. [Project Blueprint](./product/project-blueprint.md)
2. [Repository Structure](./architecture/repository-structure.md)
3. [Platform Data Model](./architecture/platform-data-model.md)
4. [API Outline](./api/api-outline.md)
5. [Naming Conventions](./architecture/naming-conventions.md)

For operation and delivery:

1. [Local Development Runbook](./runbooks/local-development.md)
2. [Production Reliability Runbook](./runbooks/production-reliability.md)
3. [Kubernetes Deployment Baseline](../infra/k8s/README.md)
4. [Roadmap](./planning/roadmap.md)

## Contribution Rules

- Update the owning document instead of creating a second status or architecture file.
- Record implemented behavior in the Snapshot and prioritized evolution in the Roadmap.
- Do not list routes, tables, or capabilities as current before the code and verification agree.
- Use lowercase `kebab-case` filenames; reserve `README` for directory indexes.
- Link durable documents from this index or a relevant parent document.
- Remove superseded plans after their lasting decisions have been consolidated.
