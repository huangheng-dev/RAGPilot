from __future__ import annotations

import asyncio

from ragpilot_api.application.mcp_connectors.mcp_connector_registry_service import McpConnectorRegistryService
from ragpilot_api.application.model_registry.model_registry_service import ModelRegistryService
from ragpilot_api.application.runtime_governance.runtime_governance_event_service import RuntimeGovernanceEventService
from ragpilot_api.application.runtime_governance.runtime_governance_worklist_service import RuntimeGovernanceWorklistService
from ragpilot_api.application.tool_registry.tool_registry_service import ToolRegistryService
from ragpilot_api.contracts.http.runtime_governance_event_contracts import (
    RuntimeGovernanceOverviewReasonCode,
    RuntimeGovernanceOverviewResponse,
)


class RuntimeGovernanceOverviewService:
    def __init__(
        self,
        model_registry_service: ModelRegistryService,
        tool_registry_service: ToolRegistryService,
        mcp_connector_registry_service: McpConnectorRegistryService,
        runtime_governance_event_service: RuntimeGovernanceEventService,
        runtime_governance_worklist_service: RuntimeGovernanceWorklistService,
    ) -> None:
        self.model_registry_service = model_registry_service
        self.tool_registry_service = tool_registry_service
        self.mcp_connector_registry_service = mcp_connector_registry_service
        self.runtime_governance_event_service = runtime_governance_event_service
        self.runtime_governance_worklist_service = runtime_governance_worklist_service

    async def get_runtime_governance_overview(
        self,
        *,
        worklist_limit: int = 24,
        recent_event_limit: int = 6,
    ) -> RuntimeGovernanceOverviewResponse:
        (
            model_summary,
            tool_summary,
            mcp_connector_summary,
            worklist,
            recent_events,
        ) = await asyncio.gather(
            self.model_registry_service.get_model_governance_summary(),
            self.tool_registry_service.get_tool_governance_summary(),
            self.mcp_connector_registry_service.get_mcp_connector_governance_summary(),
            self.runtime_governance_worklist_service.get_runtime_governance_worklist(limit=worklist_limit),
            self.runtime_governance_event_service.list_runtime_governance_events(limit=recent_event_limit),
        )

        attention_items = sum(1 for item in worklist.items if item.severity == "attention")
        review_items = sum(1 for item in worklist.items if item.severity == "review")
        primary_item = worklist.items[0] if worklist.items else None

        if primary_item is None:
            status = "stable"
            reason_code: RuntimeGovernanceOverviewReasonCode = "stable"
        elif primary_item.severity == "attention":
            status = "attention"
            reason_code = primary_item.category
        else:
            status = "review"
            reason_code = primary_item.category

        return RuntimeGovernanceOverviewResponse(
            status=status,
            reason_code=reason_code,
            attention_items=attention_items,
            review_items=review_items,
            primary_item=primary_item,
            model_summary=model_summary,
            tool_summary=tool_summary,
            mcp_connector_summary=mcp_connector_summary,
            worklist=worklist,
            recent_events=recent_events,
        )
