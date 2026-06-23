# Phase 4 Acceptance Checklist

Status: `complete`

Purpose:

- freeze the actual closure target for `Phase 4`
- prevent Phase 4 from expanding into Phase 5 concerns
- give implementation and future GitHub updates one stable acceptance boundary

## Acceptance Scope

Phase 4 closes when RagPilot satisfies all of the following inside the local product loop:

1. `Home` is reduced to scope selection plus the three primary operator lanes:
   - `Chats`
   - `Documents`
   - `Workflows`
2. `Documents -> Operations -> Chat` behaves as one coherent operator chain
3. runtime governance for model, retrieval, tool, and first MCP boundary states is backend-owned and reachable from the main operator surfaces
4. execution follow-up actions are shared and mode-aware instead of page-local guesses
5. `Settings`, `Admin`, `Agents`, and `Operations` can hand off into the same governed runtime objects without rebuilding context

## Completed

- [x] `Home` only keeps the primary operator lanes in the rendered surface
- [x] dormant home-side governance, observability, and capability sections are removed from the page implementation
- [x] workspace runtime handoff uses shared URL and intent state across `Home`, `Documents`, `Operations`, and `Chat`
- [x] grounded-validation draft prompts are shared across:
  - `Home`
  - document follow-up
  - upload completion
  - workflow completion
  - `Operations -> Chat`
- [x] workspace document and workflow sidebars no longer duplicate action buttons below the shared execution packet
- [x] `Operations` follow-up packet now removes duplicate secondary routes when they collapse to the primary path
- [x] runtime governance route resolution is shared across `Home`, `Agents`, `Admin`, and `Operations`
- [x] `Settings` object detail follow-up is converging on shared action-packet patterns
- [x] tool runtime audit and MCP boundary review are governed through backend-owned summary and queue contracts
- [x] first MCP connector registry, connector reference, and integration-pending review path exist in `Settings`

## Remaining Before Phase 4 Close

- [x] one final pass on empty-state wording and action ordering across `Documents`, `Workflows`, and `Operations`
- [x] one final pass on duplicate operator entry points in `Settings` and `Operations`
- [x] explicit Phase 4 closeout note in progress docs after the final pass is complete

## Explicitly Out of Scope

These belong to later phases and must not be used to keep Phase 4 open:

- production-grade authentication and external identity provider closure
- full MCP management surface and mature connector lifecycle
- deeper agent business workflows
- CI/CD, deployment, release automation, and production observability closure
- full LlamaIndex or LangGraph mainline replacement work

## Exit Condition

All remaining closeout items are complete and the web build is green. RagPilot can now move into `Phase 5`.
