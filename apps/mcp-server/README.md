# RAGPilot MCP Server

This service provides the dedicated `MCP`-compatible boundary for RAGPilot tool exposure.

It keeps external tool delivery isolated from the main API and worker runtimes so governed connector and tool posture can evolve through a separate process boundary.

## Service Role

The MCP server is the boundary where RAGPilot exposes:

- controlled knowledge retrieval tools
- document and workflow inspection tools
- explicit agent-facing platform operations

The core platform already governs connector health, tool registration, and runtime approval through the main API; this service exists to deliver those capabilities through an MCP-compatible external surface.
