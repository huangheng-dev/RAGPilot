# RagPilot Technology Rollout

## Purpose

This document defines the step-by-step technology rollout order for RagPilot so implementation keeps moving in one direction and does not drift into disconnected experiments.

## Rollout Rule

Technology should be introduced only when it closes a real product-chain gap.

The preferred order is:

1. stabilize the current native platform path
2. add clean extension boundaries
3. introduce one focused external technology at a time
4. validate it against a real RagPilot workflow
5. keep or remove it based on product value, not novelty

Documentation rule:

- name only technologies that are already implemented, actively piloted, or explicitly approved as RagPilot integration candidates
- do not add extra framework names to stack lists, roadmap items, UI labels, or progress reports unless they are part of this rollout document
- one technology should be taken through runtime behavior, persisted metadata, governance visibility, UI visibility, and validation before the next technology becomes the focus

## Current Ground Truth

Already implemented in the live codebase:

- `FastAPI`
- `Next.js`
- `Temporal`
- `PostgreSQL`
- `pgvector`
- `Elasticsearch`
- `Redis`
- `MinIO`
- `OpenTelemetry` baseline
- native `Ollama` chat-model routing
- governed model endpoints
- governed retrieval profiles
- governed tool registrations
- native retrieval pipeline with hybrid vector and lexical merge
- `LlamaIndex` retrieval pilot through `llamaindex_pilot`
- `vLLM` model routing through the governed `vllm` provider
- `LangGraph` agent-runtime pilot through `agent_runtime_engine=langgraph_pilot`

Not yet production-mature:

- production-grade `MCP` management
- deeper `LlamaIndex` quality evaluation, rerank integration, and promotion decisioning
- broader `LangGraph` agent lanes beyond the bounded workflow-recovery pilot

## Execution Order

### Phase 1. Retrieval Engine Boundary

Goal:

- keep the current retrieval chain stable
- create a clean engine boundary so future retrieval technology can be attached without rewriting chat or document workflows

Scope:

- keep `native` retrieval as the default engine
- add a reserved `LlamaIndex` retrieval engine slot
- keep all API contracts unchanged

Exit criteria:

- retrieval still works exactly as before with the native engine
- engine selection is explicit in backend configuration
- future `LlamaIndex` work can land behind one retrieval-engine interface

Status:

- implemented

### Phase 2. LlamaIndex Pilot Integration

Goal:

- introduce `LlamaIndex` only inside the retrieval domain
- use it as an optional orchestration layer, not as a platform replacement

Scope:

- add a first `LlamaIndex` adapter behind the retrieval-engine boundary
- start with retrieval orchestration only
- keep persistence, governance, and chat contracts inside RagPilot

Recommended first pilot:

- knowledge-base-scoped retrieval
- current `pgvector` plus lexical recall input
- optional rerank or post-processing path
- diagnostics comparison against the native retrieval engine

Exit criteria:

- the same question can be run through `native` and `LlamaIndex` paths
- result quality and citation stability can be compared directly
- no UI or workflow surface needs to know internal orchestration details

Status:

- initial pilot adapter implemented behind `llamaindex_pilot`

### Phase 3. vLLM Model Gateway Adapter

Goal:

- add a stronger private-inference runtime path without leaking provider-specific logic into product surfaces

Scope:

- add `vLLM` through the model-endpoint gateway
- treat it as another governed provider beside OpenAI-compatible and native `Ollama`
- add connection validation and runtime metadata visibility in `Settings`

Exit criteria:

- a governed `vLLM` endpoint can be created, validated, and selected
- chat runtime binding can resolve to `vLLM`
- no chat or agent page needs custom `vLLM` logic

Status:

- initial model-gateway adapter implemented through the governed `vllm` provider type

### Phase 4. LangGraph Agent Runtime Layer

Goal:

- introduce graph-based agent orchestration only after the core RAG and retrieval path is stable

Scope:

- keep `Temporal` for durable business workflows such as ingestion
- use `LangGraph` only for agent reasoning and tool-execution flow
- keep agent governance, audit, and tool approval inside RagPilot contracts

Recommended first pilot:

- one bounded agent workflow
- one retrieval step
- one tool step
- one approval boundary
- one final answer or execution summary

Exit criteria:

- graph execution is visible and auditable
- graph failure does not break the durable ingestion workflow layer
- agent orchestration remains optional and scoped

Status:

- bounded `workflow_recovery` pilot implemented behind `agent_runtime_engine=langgraph_pilot`

### Phase 5. MCP Hardening

Goal:

- turn MCP from a reserved internal boundary into a deliberate integration layer

Scope:

- keep MCP outside top-level user navigation
- improve tool exposure, transport policy, and runtime governance
- separate MCP management from core chat, document, and workflow surfaces

Exit criteria:

- MCP tools can be governed, audited, and exposed predictably
- MCP evolution does not force a redesign of primary product surfaces

Status:

- deferred

## What We Should Do Next

The next technical push should stay on this order:

1. keep the native retrieval path stable as the default production-safe behavior
2. use comparison and diagnostics to decide whether the `LlamaIndex` pilot improves real grounded-answer quality
3. continue model-runtime governance through the existing model-endpoint gateway
4. expand the bounded `LangGraph` pilot only when it improves a real agent execution path
5. harden MCP as a governed tool boundary after model, tool, and agent runtime contracts are stable

## Immediate Implementation Sequence

Use this exact execution order in the current repository:

1. keep `RETRIEVAL_ENGINE=native` as the default active runtime
2. keep `llamaindex_pilot` behind explicit configuration and comparison tools
3. keep governed model endpoints as the only path for `Ollama`, OpenAI-compatible, and `vLLM` runtime selection
4. keep `langgraph_pilot` scoped to supported agent lanes until graph execution has stronger audit and failure handling
5. keep MCP outside top-level navigation and expose it through governed tool registration only when management contracts are ready

Current completion:

- retrieval engine boundaries and the first `llamaindex_pilot` adapter are in place
- model endpoint governance includes deterministic, OpenAI-compatible, native `Ollama`, and governed `vLLM` provider paths
- the bounded `langgraph_pilot` runtime boundary is in place for workflow recovery
- tool runtime governance exists for native, HTTP, and reserved MCP-oriented registrations
- production-grade MCP management remains deferred

## Non-Goals For Now

Do not do these yet:

- replace the current platform architecture with `LlamaIndex`
- replace durable `Temporal` workflows with `LangGraph`
- expose `MCP` as a first-level user navigation area
- treat the current `langgraph_pilot` boundary as a reason to bypass RagPilot audit, governance, or approval contracts
- add unrelated framework names to the documented technology stack or progress plan
