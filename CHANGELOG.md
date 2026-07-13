# Changelog

All notable changes to RAGPilot will be documented in this file.

The format follows a Keep a Changelog style with SemVer-style release tags.

## [Unreleased]

### Added

- production delivery baseline with Kubernetes manifests, a production environment template, and a dedicated delivery audit
- responsive operator layouts across home, chat, documents, agents, operations, administration, and settings
- knowledge-scope selection for chat and document intake across workspaces and knowledge bases
- governed runtime resource management for model endpoints, tools, connectors, and retrieval profiles
- conversational intent routing for lightweight greetings without unnecessary knowledge retrieval
- authenticated browser acceptance coverage for the primary product surfaces

### Changed

- web container delivery now runs a production Next.js server instead of a development server
- local API test execution now falls back cleanly between the project virtual environment and the active Python runtime
- release preflight now includes a production delivery audit alongside docs, links, candidate-set, and secret checks
- chat conversation management now provides searchable, paged history with explicit rename and deletion actions
- document intake supports multi-file upload and web-page import within an explicit knowledge-base scope
- document, agent, chat diagnostic, and administration dialogs share a consistent responsive form and action layout
- administration, operations, and settings use aligned navigation, spacing, filters, summaries, and detail surfaces
- model request handling uses a production-oriented timeout window and explicit unavailable or timeout responses
- English and Simplified Chinese product copy is aligned across the updated operator workflows

### Security

- login surfaces no longer expose or prefill example account email addresses
- production documentation explicitly requires environment-owned identities, secrets, and runtime credentials

## [0.1.0] - 2026-06-25

### Added

- grounded chat with citations and persisted conversation history
- governed document ingestion, workflow retry, cancellation, and lineage visibility
- runtime governance for model endpoints, tool registrations, retrieval profiles, and MCP connector boundaries
- agent runtime handoff across `Home`, `Chat`, `Documents`, `Agents`, `Admin`, `Operations`, and `Settings`
- English-first repository conventions with Simplified Chinese operator support

### Established

- root-level public documentation for product, contribution, security, and release history
- release validation scripts for documentation audit, link audit, candidate audit, and secret scanning
- a public repository baseline aligned to the core knowledge, retrieval, workflow, agent, and governance architecture
