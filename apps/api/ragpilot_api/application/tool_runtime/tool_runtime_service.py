from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

import httpx

from ragpilot_api.application.errors import ResourceNotFoundError
from ragpilot_api.contracts.http.tool_runtime_contracts import ToolInvocationResponse, ToolRuntimeSummaryResponse
from ragpilot_api.infrastructure.database.models import AgentDefinition, ToolRegistration
from ragpilot_api.infrastructure.database.repositories.conversation_repository import ConversationRepository
from ragpilot_api.infrastructure.database.repositories.document_repository import DocumentRepository
from ragpilot_api.infrastructure.database.repositories.mcp_connector_repository import McpConnectorRepository
from ragpilot_api.infrastructure.database.repositories.tool_registration_repository import ToolRegistrationRepository
from ragpilot_api.infrastructure.database.repositories.workflow_repository import WorkflowRepository
from ragpilot_api.presentation.http.request_actor import RequestActor
from ragpilot_api.shared.settings import Settings
from ragpilot_api.infrastructure.mcp.client import McpProtocolError, McpStreamableHttpClient
from ragpilot_api.application.mcp_connectors.mcp_connector_registry_service import resolve_mcp_connector_environment_secret


class ToolRuntimeService:
    def __init__(
        self,
        tool_registration_repository: ToolRegistrationRepository,
        conversation_repository: ConversationRepository,
        document_repository: DocumentRepository,
        workflow_repository: WorkflowRepository,
        settings: Settings | None = None,
        mcp_connector_repository: McpConnectorRepository | None = None,
    ) -> None:
        self.tool_registration_repository = tool_registration_repository
        self.conversation_repository = conversation_repository
        self.document_repository = document_repository
        self.workflow_repository = workflow_repository
        self.settings = settings
        self.mcp_connector_repository = mcp_connector_repository

    async def execute_bound_tools(
        self,
        *,
        agent_definition: AgentDefinition,
        tenant_id: UUID,
        workspace_id: UUID | None,
        knowledge_base_id: UUID | None,
        execution_input: str | None,
        actor: RequestActor,
    ) -> ToolRuntimeSummaryResponse:
        traces: list[ToolInvocationResponse] = []
        for tool_registration_id in agent_definition.tool_registration_ids_json or []:
            traces.append(
                await self._execute_tool_registration(
                    tool_registration_id=UUID(tool_registration_id),
                    tenant_id=tenant_id,
                    workspace_id=workspace_id,
                    knowledge_base_id=knowledge_base_id,
                    execution_input=execution_input,
                    actor=actor,
                )
            )
        return build_tool_runtime_summary(traces)

    async def preview_tool_invocation(
        self,
        *,
        tool_registration_id: UUID,
        tenant_id: UUID,
        workspace_id: UUID | None,
        knowledge_base_id: UUID | None,
        execution_input: str | None,
        actor: RequestActor,
    ) -> ToolInvocationResponse:
        return await self._execute_tool_registration(
            tool_registration_id=tool_registration_id,
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            knowledge_base_id=knowledge_base_id,
            execution_input=execution_input,
            actor=actor,
        )

    async def _execute_tool_registration(
        self,
        *,
        tool_registration_id: UUID,
        tenant_id: UUID,
        workspace_id: UUID | None,
        knowledge_base_id: UUID | None,
        execution_input: str | None,
        actor: RequestActor,
    ) -> ToolInvocationResponse:
        tool_registration = await self.tool_registration_repository.get_tool_registration(
            tool_registration_id=tool_registration_id
        )
        if tool_registration is None:
            raise ResourceNotFoundError("Tool registration not found.")

        if not tool_registration.is_enabled:
            return build_tool_trace(
                tool_registration,
                invocation_status="unavailable",
                summary="Tool registration is disabled and cannot be invoked.",
            )

        if tool_registration.requires_admin_approval and actor.role != "super_admin":
            return build_tool_trace(
                tool_registration,
                invocation_status="blocked",
                summary="Tool invocation requires super-admin approval.",
            )

        if tool_registration.transport_type == "native":
            return await self._execute_native_tool(
                tool_registration=tool_registration,
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                knowledge_base_id=knowledge_base_id,
                execution_input=execution_input,
            )

        if tool_registration.transport_type == "http":
            return await self._execute_http_tool(
                tool_registration=tool_registration,
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                knowledge_base_id=knowledge_base_id,
                execution_input=execution_input,
                actor=actor,
            )

        if tool_registration.requires_admin_approval:
            return build_tool_trace(
                tool_registration,
                invocation_status="reserved",
                summary="Reserved MCP boundary is still under governance review.",
                capability_results={
                    "execution_input": execution_input,
                },
                response_metadata={
                    "boundary_status": "reviewing",
                    "connector_attached": False,
                    "connector_reference": getattr(tool_registration, "connector_reference", None),
                },
            )

        connector_reference = getattr(tool_registration, "connector_reference", None)
        if connector_reference and self.mcp_connector_repository is not None:
            return await self._execute_mcp_tool(
                tool_registration=tool_registration,
                connector_reference=connector_reference,
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                knowledge_base_id=knowledge_base_id,
                execution_input=execution_input,
            )
        return build_tool_trace(
            tool_registration,
            invocation_status="unavailable",
            governance_issue="mcp_integration_pending",
            summary=(
                "Reserved MCP boundary is cleared and a connector reference is configured, but the runtime bridge is not attached yet."
                if connector_reference
                else "Reserved MCP boundary is cleared, but no runtime connector is attached yet."
            ),
            capability_results={
                "execution_input": execution_input,
            },
            response_metadata={
                "boundary_status": "ready_for_integration",
                "connector_attached": False,
                "connector_reference": connector_reference,
            },
        )

    async def _execute_mcp_tool(
        self,
        *,
        tool_registration: ToolRegistration,
        connector_reference: str,
        tenant_id: UUID,
        workspace_id: UUID | None,
        knowledge_base_id: UUID | None,
        execution_input: str | None,
    ) -> ToolInvocationResponse:
        connector = await self.mcp_connector_repository.get_mcp_connector_by_slug(
            connector_slug=connector_reference,
        )
        if connector is None or not connector.is_enabled or not connector.base_url:
            return build_tool_trace(
                tool_registration,
                invocation_status="unavailable",
                governance_issue="mcp_integration_pending",
                summary="The configured MCP connector is missing, disabled, or has no runtime URL.",
                response_metadata={"connector_reference": connector_reference, "connector_attached": False},
            )

        client = McpStreamableHttpClient(
            base_url=connector.base_url,
            bearer_token=resolve_mcp_connector_environment_secret(connector.credential_key_hint),
            timeout_seconds=float(self._resolve_request_timeout_seconds()),
        )
        try:
            await client.initialize()
            tools = await client.list_tools()
            available_names = {
                str(tool.get("name"))
                for tool in tools
                if isinstance(tool.get("name"), str)
            }
            explicit_tool_name = next(
                (
                    capability.split(":", 1)[1].strip()
                    for capability in list(tool_registration.capabilities_json or [])
                    if isinstance(capability, str)
                    and capability.startswith("mcp_tool:")
                    and capability.split(":", 1)[1].strip()
                ),
                None,
            )
            requested_name = explicit_tool_name or tool_registration.slug
            if requested_name not in available_names:
                return build_tool_trace(
                    tool_registration,
                    invocation_status="unavailable",
                    governance_issue="mcp_tool_missing",
                    summary=f"MCP connector does not advertise the requested tool '{requested_name}'.",
                    response_metadata={
                        "connector_reference": connector_reference,
                        "connector_attached": True,
                        "available_tools": sorted(available_names),
                    },
                )
            selected_tool = next(tool for tool in tools if tool.get("name") == requested_name)
            input_schema = selected_tool.get("inputSchema") if isinstance(selected_tool.get("inputSchema"), dict) else {}
            schema_properties = input_schema.get("properties") if isinstance(input_schema.get("properties"), dict) else {}
            required_arguments = {
                value
                for value in (input_schema.get("required") if isinstance(input_schema.get("required"), list) else [])
                if isinstance(value, str)
            }
            available_arguments = {
                "input": execution_input,
                "tenant_id": str(tenant_id),
                "workspace_id": str(workspace_id) if workspace_id else None,
                "knowledge_base_id": str(knowledge_base_id) if knowledge_base_id else None,
            }
            arguments = (
                {key: value for key, value in available_arguments.items() if key in schema_properties}
                if schema_properties
                else {"input": execution_input}
            )
            missing_required_arguments = sorted(
                key for key in required_arguments if key not in arguments or arguments[key] is None
            )
            if missing_required_arguments:
                return build_tool_trace(
                    tool_registration,
                    invocation_status="blocked",
                    governance_issue="mcp_arguments_missing",
                    summary="MCP tool invocation is missing required arguments.",
                    request_metadata={
                        "connector_reference": connector_reference,
                        "tool_name": requested_name,
                        "missing_required_arguments": missing_required_arguments,
                    },
                )

            max_attempts = self._resolve_max_attempts()
            result = None
            last_error: Exception | None = None
            for attempt_count in range(1, max_attempts + 1):
                try:
                    result = await client.call_tool(name=requested_name, arguments=arguments)
                    break
                except (httpx.HTTPError, McpProtocolError) as error:
                    last_error = error
                    if attempt_count >= max_attempts:
                        raise
            if result is None:
                raise McpProtocolError(str(last_error or "MCP tool invocation returned no result."))
        except (httpx.HTTPError, McpProtocolError) as error:
            return build_tool_trace(
                tool_registration,
                invocation_status="failed",
                governance_issue="runtime_failure",
                summary="MCP tool invocation failed.",
                response_metadata={"connector_reference": connector_reference, "connector_attached": True},
                error_message=str(error),
            )

        session_id = client.session_id
        try:
            await client.close()
        except httpx.HTTPError:
            pass
        is_error = bool(result.get("isError"))
        return build_tool_trace(
            tool_registration,
            invocation_status="failed" if is_error else "completed",
            summary="MCP tool returned an error result." if is_error else "MCP tool invocation completed successfully.",
            capability_results={"mcp_result": result},
            response_metadata={
                "connector_reference": connector_reference,
                "connector_attached": True,
                "mcp_session_id": session_id,
                "tool_name": requested_name,
                "tool_name_source": "capability_mapping" if explicit_tool_name else "registration_slug",
                "argument_keys": sorted(arguments),
                "attempt_count": attempt_count,
            },
            error_message="MCP tool reported isError=true." if is_error else None,
        )

    async def _execute_native_tool(
        self,
        *,
        tool_registration: ToolRegistration,
        tenant_id: UUID,
        workspace_id: UUID | None,
        knowledge_base_id: UUID | None,
        execution_input: str | None,
    ) -> ToolInvocationResponse:
        capability_results: dict[str, object] = {}
        supported_capability_count = 0
        unsupported_capabilities: list[str] = []

        for capability in list(tool_registration.capabilities_json or []):
            normalized_capability = capability.strip().lower()
            if normalized_capability == "":
                continue

            if normalized_capability == "conversation_metrics":
                if workspace_id is None:
                    capability_results[normalized_capability] = {"status": "scope_missing"}
                    continue
                supported_capability_count += 1
                capability_results[normalized_capability] = await self.conversation_repository.get_conversation_metrics(
                    tenant_id=tenant_id,
                    workspace_id=workspace_id,
                )
                continue

            if normalized_capability == "document_metrics":
                if knowledge_base_id is None:
                    capability_results[normalized_capability] = {"status": "scope_missing"}
                    continue
                supported_capability_count += 1
                capability_results[normalized_capability] = await self.document_repository.get_document_metrics(
                    knowledge_base_id=knowledge_base_id
                )
                continue

            if normalized_capability == "recent_documents":
                if knowledge_base_id is None:
                    capability_results[normalized_capability] = {"status": "scope_missing"}
                    continue
                supported_capability_count += 1
                recent_documents, total_documents = await self.document_repository.list_documents(
                    knowledge_base_id=knowledge_base_id,
                    status_filter="all",
                    sort_order="created-desc",
                    limit=3,
                    offset=0,
                )
                capability_results[normalized_capability] = {
                    "total_documents": total_documents,
                    "items": [
                        {
                            "id": str(document.id),
                            "title": document.title,
                            "ingestion_status": document.ingestion_status,
                            "indexing_status": document.indexing_status,
                        }
                        for document in recent_documents
                    ],
                }
                continue

            if normalized_capability == "workflow_metrics":
                supported_capability_count += 1
                capability_results[normalized_capability] = await self.workflow_repository.get_workflow_metrics(
                    tenant_id=tenant_id
                )
                continue

            if normalized_capability == "recent_failed_workflow_runs":
                supported_capability_count += 1
                failed_runs, total_failed_runs = await self.workflow_repository.list_workflow_runs(
                    tenant_id=tenant_id,
                    status_filter="failed",
                    sort_order="updated-desc",
                    limit=3,
                    offset=0,
                )
                capability_results[normalized_capability] = {
                    "total_failed_runs": total_failed_runs,
                    "items": [
                        {
                            "id": str(workflow_run.id),
                            "workflow_type": workflow_run.workflow_type,
                            "workflow_status": workflow_run.workflow_status,
                            "subject_type": workflow_run.subject_type,
                            "subject_id": str(workflow_run.subject_id) if workflow_run.subject_id else None,
                            "error_message": workflow_run.error_message,
                        }
                        for workflow_run in failed_runs
                    ],
                }
                continue

            if normalized_capability == "scope_summary":
                supported_capability_count += 1
                capability_results[normalized_capability] = {
                    "tenant_id": str(tenant_id),
                    "workspace_id": str(workspace_id) if workspace_id is not None else None,
                    "knowledge_base_id": str(knowledge_base_id) if knowledge_base_id is not None else None,
                    "execution_input": execution_input,
                }
                continue

            unsupported_capabilities.append(normalized_capability)

        if supported_capability_count == 0:
            return build_tool_trace(
                tool_registration,
                invocation_status="skipped",
                summary="Tool registration does not expose any supported native capabilities yet.",
                capability_results={"unsupported_capabilities": unsupported_capabilities},
            )

        if unsupported_capabilities:
            capability_results["unsupported_capabilities"] = unsupported_capabilities

        return build_tool_trace(
            tool_registration,
            invocation_status="completed",
            summary=f"Executed {supported_capability_count} native capability checks.",
            capability_results=capability_results,
        )

    async def _execute_http_tool(
        self,
        *,
        tool_registration: ToolRegistration,
        tenant_id: UUID,
        workspace_id: UUID | None,
        knowledge_base_id: UUID | None,
        execution_input: str | None,
        actor: RequestActor,
    ) -> ToolInvocationResponse:
        if not tool_registration.endpoint_url:
            return build_tool_trace(
                tool_registration,
                invocation_status="unavailable",
                summary="HTTP tool transport is missing an endpoint URL.",
            )

        request_timeout_seconds = self._resolve_request_timeout_seconds()
        max_attempts = self._resolve_max_attempts()
        request_payload = {
            "tool_registration": {
                "id": str(tool_registration.id),
                "name": tool_registration.name,
                "slug": tool_registration.slug,
                "transport_type": tool_registration.transport_type,
                "surface_area": tool_registration.surface_area,
                "capabilities": list(tool_registration.capabilities_json or []),
            },
            "scope": {
                "tenant_id": str(tenant_id),
                "workspace_id": str(workspace_id) if workspace_id is not None else None,
                "knowledge_base_id": str(knowledge_base_id) if knowledge_base_id is not None else None,
            },
            "execution_input": execution_input,
            "actor": {
                "role": actor.role,
                "user_id": (
                    str(getattr(actor, "user_id"))
                    if getattr(actor, "user_id", None) is not None
                    else None
                ),
            },
        }
        request_metadata = {
            "timeout_seconds": request_timeout_seconds,
            "max_attempts": max_attempts,
        }

        try:
            async with httpx.AsyncClient(timeout=request_timeout_seconds) as client:
                for attempt_count in range(1, max_attempts + 1):
                    try:
                        response = await client.post(tool_registration.endpoint_url, json=request_payload)
                    except httpx.HTTPError as error:
                        if self._is_retryable_http_error(error) and attempt_count < max_attempts:
                            continue

                        return build_tool_trace(
                            tool_registration,
                            invocation_status="failed",
                            summary="HTTP tool invocation failed before a successful response was received.",
                            capability_results={
                                "endpoint_url": tool_registration.endpoint_url,
                            },
                            request_metadata={
                                **request_metadata,
                                "attempt_count": attempt_count,
                            },
                            response_metadata={
                                "error_type": error.__class__.__name__,
                                "retried": attempt_count > 1,
                            },
                            error_message=str(error),
                        )

                    payload = self._parse_http_response_payload(response)
                    invocation_status = (
                        str(payload.get("invocation_status")).strip().lower()
                        if isinstance(payload.get("invocation_status"), str)
                        else ("completed" if response.is_success else "failed")
                    )
                    if invocation_status not in {"completed", "blocked", "reserved", "unavailable", "failed", "skipped"}:
                        invocation_status = "completed" if response.is_success else "failed"

                    if response.is_success:
                        return build_tool_trace(
                            tool_registration,
                            invocation_status=invocation_status,
                            summary=str(payload.get("summary") or "HTTP tool invocation completed successfully."),
                            capability_results=(
                                payload.get("capability_results")
                                if isinstance(payload.get("capability_results"), dict)
                                else payload
                            ),
                            request_metadata={
                                **request_metadata,
                                "attempt_count": attempt_count,
                            },
                            response_metadata={
                                "status_code": response.status_code,
                                "retried": attempt_count > 1,
                            },
                            error_message=str(payload.get("error_message")) if payload.get("error_message") else None,
                        )

                    if response.status_code in self._resolve_retryable_status_codes() and attempt_count < max_attempts:
                        continue

                    return build_tool_trace(
                        tool_registration,
                        invocation_status="failed",
                        summary=str(payload.get("summary") or f"HTTP tool invocation failed with status {response.status_code}."),
                        capability_results={
                            "status_code": response.status_code,
                            "payload": payload,
                        },
                        request_metadata={
                            **request_metadata,
                            "attempt_count": attempt_count,
                        },
                        response_metadata={
                            "status_code": response.status_code,
                            "retried": attempt_count > 1,
                        },
                        error_message=str(payload.get("error_message") or f"HTTP {response.status_code}"),
                    )
        except httpx.HTTPError as error:
            return build_tool_trace(
                tool_registration,
                invocation_status="failed",
                summary="HTTP tool invocation failed before a successful response was received.",
                capability_results={
                    "endpoint_url": tool_registration.endpoint_url,
                },
                request_metadata=request_metadata,
                response_metadata={
                    "error_type": error.__class__.__name__,
                    "retried": False,
                },
                error_message=str(error),
            )

    def _resolve_request_timeout_seconds(self) -> int:
        if self.settings is None:
            return 30
        return max(int(self.settings.tool_runtime_request_timeout_seconds), 1)

    def _resolve_max_attempts(self) -> int:
        if self.settings is None:
            return 1
        return max(int(self.settings.tool_runtime_max_attempts), 1)

    def _resolve_retryable_status_codes(self) -> set[int]:
        if self.settings is None:
            return {502, 503, 504}
        return self.settings.tool_runtime_retryable_status_code_set or {502, 503, 504}

    def _is_retryable_http_error(self, error: httpx.HTTPError) -> bool:
        return isinstance(error, (httpx.ConnectError, httpx.ReadTimeout, httpx.RemoteProtocolError, httpx.WriteError))

    def _parse_http_response_payload(self, response: httpx.Response) -> dict:
        try:
            payload = response.json()
        except ValueError:
            payload = {
                "raw_response": response.text,
            }

        if isinstance(payload, dict):
            return payload

        return {
            "raw_response": payload,
        }


def build_tool_trace(
    tool_registration: ToolRegistration,
    *,
    invocation_status: str,
    summary: str,
    governance_issue: str | None = None,
    capability_results: dict | None = None,
    request_metadata: dict | None = None,
    response_metadata: dict | None = None,
    error_message: str | None = None,
) -> ToolInvocationResponse:
        return ToolInvocationResponse(
        tool_registration_id=tool_registration.id,
        name=tool_registration.name,
        slug=tool_registration.slug,
        transport_type=tool_registration.transport_type,
        surface_area=tool_registration.surface_area,
        invocation_status=invocation_status,
        governance_issue=governance_issue
        if governance_issue is not None
        else resolve_tool_runtime_governance_issue(
            invocation_status=invocation_status,
            transport_type=tool_registration.transport_type,
        ),
        endpoint_url=tool_registration.endpoint_url,
        summary=summary,
        capability_results=capability_results or {},
        request_metadata=request_metadata or {},
        response_metadata=response_metadata or {},
        error_message=error_message,
        executed_at=datetime.now(timezone.utc),
    )


def resolve_tool_runtime_governance_issue(
    *,
    invocation_status: str,
    transport_type: str,
) -> str | None:
    if invocation_status == "blocked":
        return "approval_required"
    if invocation_status == "unavailable":
        return "tool_disabled"
    if invocation_status == "reserved":
        return "mcp_reserved"
    if invocation_status == "failed":
        if transport_type == "http":
            return "endpoint_failure"
        return "runtime_failure"
    return None


def build_tool_runtime_summary(traces: list[ToolInvocationResponse]) -> ToolRuntimeSummaryResponse:
    return ToolRuntimeSummaryResponse(
        total_bound_tools=len(traces),
        completed_tools=sum(1 for trace in traces if trace.invocation_status == "completed"),
        blocked_tools=sum(1 for trace in traces if trace.invocation_status == "blocked"),
        reserved_tools=sum(1 for trace in traces if trace.invocation_status == "reserved"),
        unavailable_tools=sum(1 for trace in traces if trace.invocation_status == "unavailable"),
        failed_tools=sum(1 for trace in traces if trace.invocation_status == "failed"),
        skipped_tools=sum(1 for trace in traces if trace.invocation_status == "skipped"),
        traces=traces,
    )
