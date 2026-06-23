import os
from datetime import datetime, timezone
from uuid import UUID

import httpx

from ragpilot_api.application.errors import ResourceConflictError, ResourceNotFoundError
from ragpilot_api.contracts.http.mcp_connector_contracts import (
    McpConnectorAuthGovernanceBreakdownResponse,
    McpConnectorCreateRequest,
    McpConnectorGovernanceSummaryResponse,
    McpConnectorPreviewResponse,
    McpConnectorResponse,
    McpConnectorTypeGovernanceBreakdownResponse,
    McpConnectorUpdateRequest,
)
from ragpilot_api.infrastructure.database.models import McpConnector
from ragpilot_api.infrastructure.database.repositories.mcp_connector_repository import McpConnectorRepository
from ragpilot_api.infrastructure.database.repositories.tool_registration_repository import ToolRegistrationRepository


class McpConnectorRegistryService:
    def __init__(
        self,
        mcp_connector_repository: McpConnectorRepository,
        tool_registration_repository: ToolRegistrationRepository,
    ) -> None:
        self.mcp_connector_repository = mcp_connector_repository
        self.tool_registration_repository = tool_registration_repository

    async def create_mcp_connector(self, request: McpConnectorCreateRequest) -> McpConnectorResponse:
        mcp_connector = await self.mcp_connector_repository.create_mcp_connector(
            name=request.name,
            slug=request.slug,
            connector_type=request.connector_type,
            base_url=normalize_mcp_connector_base_url(request.base_url),
            auth_mode=request.auth_mode,
            credential_key_hint=normalize_mcp_connector_credential_key_hint(request.credential_key_hint),
            notes=request.notes,
            is_enabled=request.is_enabled,
        )
        return build_mcp_connector_response(mcp_connector)

    async def list_mcp_connectors(
        self,
        *,
        connector_type: str | None = None,
        is_enabled: bool | None = None,
        runtime_state: str | None = None,
        query: str | None = None,
    ) -> list[McpConnectorResponse]:
        mcp_connectors = await self.mcp_connector_repository.list_mcp_connectors(
            connector_type=connector_type,
            is_enabled=is_enabled,
            query=query,
        )
        tool_counts = await self._build_tool_reference_counts()
        responses = [
            build_mcp_connector_response(
                mcp_connector,
                referenced_tool_count=tool_counts.get(mcp_connector.slug, {}).get("referenced_tool_count", 0),
                integration_ready_tool_count=tool_counts.get(mcp_connector.slug, {}).get("integration_ready_tool_count", 0),
            )
            for mcp_connector in mcp_connectors
        ]
        if runtime_state is None:
            return responses
        return [response for response in responses if _matches_mcp_connector_runtime_state(response, runtime_state)]

    async def update_mcp_connector(
        self,
        *,
        mcp_connector_id: UUID,
        request: McpConnectorUpdateRequest,
    ) -> McpConnectorResponse | None:
        mcp_connector = await self.mcp_connector_repository.update_mcp_connector(
            mcp_connector_id=mcp_connector_id,
            name=request.name,
            slug=request.slug,
            connector_type=request.connector_type,
            base_url=normalize_mcp_connector_base_url(request.base_url),
            auth_mode=request.auth_mode,
            credential_key_hint=normalize_mcp_connector_credential_key_hint(request.credential_key_hint),
            notes=request.notes,
            is_enabled=request.is_enabled,
        )
        if mcp_connector is None:
            return None
        tool_counts = await self._build_tool_reference_counts()
        return build_mcp_connector_response(
            mcp_connector,
            referenced_tool_count=tool_counts.get(mcp_connector.slug, {}).get("referenced_tool_count", 0),
            integration_ready_tool_count=tool_counts.get(mcp_connector.slug, {}).get("integration_ready_tool_count", 0),
        )

    async def delete_mcp_connector(self, *, mcp_connector_id: UUID) -> bool:
        mcp_connector = await self.mcp_connector_repository.get_mcp_connector(mcp_connector_id=mcp_connector_id)
        if mcp_connector is None:
            return False
        tool_counts = await self._build_tool_reference_counts()
        referenced_tool_count = tool_counts.get(mcp_connector.slug, {}).get("referenced_tool_count", 0)
        if referenced_tool_count > 0:
            noun = "tool" if referenced_tool_count == 1 else "tools"
            raise ResourceConflictError(
                f"MCP connector is still referenced by {referenced_tool_count} reserved {noun}. Remove or retarget those tool registrations before deleting it."
            )
        return await self.mcp_connector_repository.delete_mcp_connector(mcp_connector_id=mcp_connector_id)

    async def get_mcp_connector_governance_summary(self) -> McpConnectorGovernanceSummaryResponse:
        mcp_connectors = await self.mcp_connector_repository.list_mcp_connectors()
        tool_counts = await self._build_tool_reference_counts()

        type_breakdown: dict[str, McpConnectorTypeGovernanceBreakdownResponse] = {
            "streamable_http": McpConnectorTypeGovernanceBreakdownResponse(connector_type="streamable_http"),
            "sse": McpConnectorTypeGovernanceBreakdownResponse(connector_type="sse"),
            "managed_reserved": McpConnectorTypeGovernanceBreakdownResponse(connector_type="managed_reserved"),
        }
        auth_breakdown: dict[str, McpConnectorAuthGovernanceBreakdownResponse] = {
            "none": McpConnectorAuthGovernanceBreakdownResponse(auth_mode="none"),
            "environment": McpConnectorAuthGovernanceBreakdownResponse(auth_mode="environment"),
            "managed_reserved": McpConnectorAuthGovernanceBreakdownResponse(auth_mode="managed_reserved"),
        }
        summary = McpConnectorGovernanceSummaryResponse()

        for mcp_connector in mcp_connectors:
            counts = tool_counts.get(mcp_connector.slug, {})
            referenced_tool_count = counts.get("referenced_tool_count", 0)
            integration_ready_tool_count = counts.get("integration_ready_tool_count", 0)
            runtime_ready = is_mcp_connector_runtime_ready(mcp_connector)

            summary.total_connectors += 1
            if mcp_connector.is_enabled:
                summary.enabled_connectors += 1
            else:
                summary.disabled_connectors += 1
            if referenced_tool_count > 0:
                summary.referenced_connectors += 1
            if integration_ready_tool_count > 0:
                summary.integration_ready_connectors += 1
            if runtime_ready:
                summary.runtime_ready_connectors += 1
            if requires_mcp_connector_base_url(mcp_connector.connector_type) and not (mcp_connector.base_url or "").strip():
                summary.missing_base_url_connectors += 1
            if mcp_connector.auth_mode == "environment":
                summary.environment_auth_connectors += 1
                if not (mcp_connector.credential_key_hint or "").strip():
                    summary.missing_credential_hint_connectors += 1
            if (
                mcp_connector.connector_type == "managed_reserved"
                or mcp_connector.auth_mode == "managed_reserved"
            ):
                summary.managed_reserved_connectors += 1

            type_entry = type_breakdown[mcp_connector.connector_type]
            type_entry.total_connectors += 1
            if mcp_connector.is_enabled:
                type_entry.enabled_connectors += 1
            if referenced_tool_count > 0:
                type_entry.referenced_connectors += 1
            if runtime_ready:
                type_entry.runtime_ready_connectors += 1

            auth_entry = auth_breakdown[mcp_connector.auth_mode]
            auth_entry.total_connectors += 1
            if mcp_connector.is_enabled:
                auth_entry.enabled_connectors += 1
            if is_mcp_connector_configured(mcp_connector):
                auth_entry.configured_connectors += 1

        summary.type_breakdown = list(type_breakdown.values())
        summary.auth_breakdown = list(auth_breakdown.values())
        return summary

    async def preview_mcp_connector(self, *, mcp_connector_id: UUID) -> McpConnectorPreviewResponse:
        mcp_connector = await self.mcp_connector_repository.get_mcp_connector(mcp_connector_id=mcp_connector_id)
        if mcp_connector is None:
            raise ResourceNotFoundError("MCP connector not found.")

        request_metadata = {
            "connector_type": mcp_connector.connector_type,
            "base_url": mcp_connector.base_url,
            "auth_mode": mcp_connector.auth_mode,
            "credential_key_hint": mcp_connector.credential_key_hint,
        }
        if not mcp_connector.is_enabled:
            return build_mcp_connector_preview_response(
                mcp_connector,
                preview_status="blocked",
                summary="MCP connector is disabled and cannot be previewed.",
                request_metadata=request_metadata,
                error_message="Enable this MCP connector before running a preview.",
            )
        if (
            mcp_connector.connector_type == "managed_reserved"
            or mcp_connector.auth_mode == "managed_reserved"
        ):
            return build_mcp_connector_preview_response(
                mcp_connector,
                preview_status="blocked",
                summary="Managed-reserved MCP connectors cannot be previewed yet.",
                request_metadata=request_metadata,
                error_message="Switch this connector to a real remote transport before previewing it.",
            )
        if requires_mcp_connector_base_url(mcp_connector.connector_type) and not (mcp_connector.base_url or "").strip():
            return build_mcp_connector_preview_response(
                mcp_connector,
                preview_status="blocked",
                summary="MCP connector preview requires a base URL.",
                request_metadata=request_metadata,
                error_message="Set the remote MCP connector base URL before running a preview.",
            )

        credential_present = None
        if mcp_connector.auth_mode == "environment":
            credential_present = bool(resolve_mcp_connector_environment_secret(mcp_connector.credential_key_hint))
            request_metadata["credential_present"] = credential_present
            if not (mcp_connector.credential_key_hint or "").strip():
                return build_mcp_connector_preview_response(
                    mcp_connector,
                    preview_status="blocked",
                    summary="MCP connector preview requires an environment credential hint.",
                    request_metadata=request_metadata,
                    error_message="Set the credential environment-variable hint before previewing this connector.",
                )

        try:
            async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
                response = await client.get(mcp_connector.base_url or "")
        except httpx.HTTPError as error:
            return build_mcp_connector_preview_response(
                mcp_connector,
                preview_status="failed",
                summary="MCP connector preview could not reach the remote endpoint.",
                request_metadata=request_metadata,
                error_message=str(error),
            )

        return build_mcp_connector_preview_response(
            mcp_connector,
            preview_status="completed",
            summary=(
                f"MCP connector endpoint responded with HTTP {response.status_code}. "
                "The remote host is reachable for future runtime bridge work."
            ),
            request_metadata=request_metadata,
            response_metadata={
                "status_code": response.status_code,
                "content_type": response.headers.get("content-type"),
            },
        )

    async def _build_tool_reference_counts(self) -> dict[str, dict[str, int]]:
        tool_registrations = await self.tool_registration_repository.list_tool_registrations(
            transport_type="mcp_reserved"
        )
        counts: dict[str, dict[str, int]] = {}
        for tool_registration in tool_registrations:
            connector_reference = (getattr(tool_registration, "connector_reference", None) or "").strip()
            if not connector_reference:
                continue
            entry = counts.setdefault(
                connector_reference,
                {
                    "referenced_tool_count": 0,
                    "integration_ready_tool_count": 0,
                },
            )
            entry["referenced_tool_count"] += 1
            if tool_registration.is_enabled and not tool_registration.requires_admin_approval:
                entry["integration_ready_tool_count"] += 1
        return counts


def normalize_mcp_connector_base_url(base_url: str | None) -> str | None:
    if base_url is None:
        return None
    normalized = base_url.strip()
    return normalized or None


def normalize_mcp_connector_credential_key_hint(credential_key_hint: str | None) -> str | None:
    if credential_key_hint is None:
        return None
    normalized = credential_key_hint.strip()
    return normalized or None


def requires_mcp_connector_base_url(connector_type: str) -> bool:
    return connector_type in {"streamable_http", "sse"}


def is_mcp_connector_configured(mcp_connector: McpConnector) -> bool:
    if mcp_connector.connector_type == "managed_reserved":
        return False
    if mcp_connector.auth_mode == "managed_reserved":
        return False
    if requires_mcp_connector_base_url(mcp_connector.connector_type) and not (mcp_connector.base_url or "").strip():
        return False
    if mcp_connector.auth_mode == "environment" and not (mcp_connector.credential_key_hint or "").strip():
        return False
    return True


def is_mcp_connector_runtime_ready(mcp_connector: McpConnector) -> bool:
    return mcp_connector.is_enabled and is_mcp_connector_configured(mcp_connector)


def resolve_mcp_connector_environment_secret(credential_key_hint: str | None) -> str | None:
    if credential_key_hint is None or credential_key_hint.strip() == "":
        return None
    resolved = os.getenv(credential_key_hint.strip())
    return resolved.strip() if resolved and resolved.strip() else None


def _matches_mcp_connector_runtime_state(
    mcp_connector: McpConnectorResponse,
    runtime_state: str,
) -> bool:
    if runtime_state == "disabled":
        return not mcp_connector.is_enabled
    if runtime_state == "missing_base_url":
        return requires_mcp_connector_base_url(mcp_connector.connector_type) and not (mcp_connector.base_url or "").strip()
    if runtime_state == "missing_credential_hint":
        return mcp_connector.auth_mode == "environment" and not (mcp_connector.credential_key_hint or "").strip()
    if runtime_state == "managed_reserved":
        return (
            mcp_connector.connector_type == "managed_reserved"
            or mcp_connector.auth_mode == "managed_reserved"
        )
    if runtime_state == "referenced":
        return mcp_connector.referenced_tool_count > 0
    if runtime_state == "runtime_ready":
        return (
            mcp_connector.is_enabled
            and is_mcp_connector_response_configured(mcp_connector)
        )
    return True


def is_mcp_connector_response_configured(mcp_connector: McpConnectorResponse) -> bool:
    if mcp_connector.connector_type == "managed_reserved":
        return False
    if mcp_connector.auth_mode == "managed_reserved":
        return False
    if requires_mcp_connector_base_url(mcp_connector.connector_type) and not (mcp_connector.base_url or "").strip():
        return False
    if mcp_connector.auth_mode == "environment" and not (mcp_connector.credential_key_hint or "").strip():
        return False
    return True


def build_mcp_connector_response(
    mcp_connector: McpConnector,
    *,
    referenced_tool_count: int = 0,
    integration_ready_tool_count: int = 0,
) -> McpConnectorResponse:
    return McpConnectorResponse(
        id=mcp_connector.id,
        name=mcp_connector.name,
        slug=mcp_connector.slug,
        connector_type=mcp_connector.connector_type,
        base_url=mcp_connector.base_url,
        auth_mode=mcp_connector.auth_mode,
        credential_key_hint=mcp_connector.credential_key_hint,
        notes=mcp_connector.notes,
        is_enabled=mcp_connector.is_enabled,
        referenced_tool_count=referenced_tool_count,
        integration_ready_tool_count=integration_ready_tool_count,
        created_at=mcp_connector.created_at,
        updated_at=mcp_connector.updated_at,
    )


def build_mcp_connector_preview_response(
    mcp_connector: McpConnector,
    *,
    preview_status: str,
    summary: str,
    request_metadata: dict[str, object] | None = None,
    response_metadata: dict[str, object] | None = None,
    error_message: str | None = None,
) -> McpConnectorPreviewResponse:
    return McpConnectorPreviewResponse(
        mcp_connector_id=mcp_connector.id,
        name=mcp_connector.name,
        slug=mcp_connector.slug,
        connector_type=mcp_connector.connector_type,
        preview_status=preview_status,
        summary=summary,
        request_metadata=request_metadata or {},
        response_metadata=response_metadata or {},
        error_message=error_message,
        executed_at=datetime.now(timezone.utc),
    )
