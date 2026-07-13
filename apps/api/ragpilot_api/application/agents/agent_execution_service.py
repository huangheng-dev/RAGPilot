from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from ragpilot_api.application.errors import ResourceNotFoundError
from ragpilot_api.application.agents.agent_runtime_engines import (
    build_agent_runtime_engine,
    normalize_agent_runtime_engine_name,
)
from ragpilot_api.application.model_gateway.model_gateway import ModelGateway
from ragpilot_api.application.model_gateway.runtime_binding_resolver import RuntimeBindingResolver
from ragpilot_api.application.retrieval.retrieval_engines import normalize_retrieval_engine_name
from ragpilot_api.application.retrieval.retrieval_runtime import execute_retrieval
from ragpilot_api.application.tool_runtime.tool_runtime_service import ToolRuntimeService
from ragpilot_api.contracts.http.agent_execution_contracts import (
    AgentExecutionCreateRequest,
    AgentExecutionMetricsResponse,
    AgentExecutionOutputResponse,
    AgentExecutionResponse,
    AgentExecutionTaskStateResponse,
)
from ragpilot_api.infrastructure.database.models import AgentDefinition, AgentExecution
from ragpilot_api.infrastructure.database.repositories.agent_execution_repository import AgentExecutionRepository
from ragpilot_api.infrastructure.database.repositories.agent_repository import AgentRepository
from ragpilot_api.infrastructure.database.repositories.conversation_repository import ConversationRepository
from ragpilot_api.infrastructure.database.repositories.document_repository import DocumentRepository
from ragpilot_api.infrastructure.database.repositories.knowledge_base_repository import KnowledgeBaseRepository
from ragpilot_api.infrastructure.database.repositories.model_endpoint_repository import ModelEndpointRepository
from ragpilot_api.infrastructure.database.repositories.retrieval_profile_repository import RetrievalProfileRepository
from ragpilot_api.infrastructure.database.repositories.retrieval_repository import RetrievalRepository
from ragpilot_api.infrastructure.database.repositories.workflow_repository import WorkflowRepository
from ragpilot_api.infrastructure.database.repositories.workspace_repository import WorkspaceRepository
from ragpilot_api.presentation.http.request_actor import RequestActor
from ragpilot_api.shared.settings import Settings
from ragpilot_api.infrastructure.workflows.temporal_client import TemporalWorkflowClient


@dataclass(frozen=True)
class ResolvedAgentScope:
    workspace_id: UUID | None
    knowledge_base_id: UUID | None
    scope_issue: str | None


@dataclass(frozen=True)
class RecommendedActionSpec:
    action_key: str
    action_label: str
    target_surface: str = "workspace"
    action_category: str = "continue"
    target_view: str | None = None
    priority: str = "secondary"
    handoff_intent: str | None = None
    document_status: str | None = None
    workflow_status: str | None = None
    model_endpoint_id: str | None = None
    tool_registration_id: str | None = None
    retrieval_profile_id: str | None = None
    mcp_connector_slug: str | None = None

    def to_json(self) -> dict[str, Any]:
        return {
            "action_key": self.action_key,
            "action_label": self.action_label,
            "target_surface": self.target_surface,
            "action_category": self.action_category,
            "target_view": self.target_view,
            "priority": self.priority,
            "handoff_intent": self.handoff_intent,
            "document_status": self.document_status,
            "workflow_status": self.workflow_status,
            "model_endpoint_id": self.model_endpoint_id,
            "tool_registration_id": self.tool_registration_id,
            "retrieval_profile_id": self.retrieval_profile_id,
            "mcp_connector_slug": self.mcp_connector_slug,
        }


class AgentExecutionService:
    def __init__(
        self,
        agent_repository: AgentRepository,
        agent_execution_repository: AgentExecutionRepository,
        workspace_repository: WorkspaceRepository,
        knowledge_base_repository: KnowledgeBaseRepository,
        conversation_repository: ConversationRepository,
        document_repository: DocumentRepository,
        workflow_repository: WorkflowRepository,
        model_endpoint_repository: ModelEndpointRepository | None = None,
        retrieval_repository: RetrievalRepository | None = None,
        retrieval_profile_repository: RetrievalProfileRepository | None = None,
        settings: Settings | None = None,
        model_gateway: ModelGateway | None = None,
        tool_runtime_service: ToolRuntimeService | None = None,
        temporal_workflow_client: TemporalWorkflowClient | None = None,
    ) -> None:
        self.agent_repository = agent_repository
        self.agent_execution_repository = agent_execution_repository
        self.workspace_repository = workspace_repository
        self.knowledge_base_repository = knowledge_base_repository
        self.conversation_repository = conversation_repository
        self.document_repository = document_repository
        self.workflow_repository = workflow_repository
        self.retrieval_repository = retrieval_repository
        self.retrieval_profile_repository = retrieval_profile_repository
        self.settings = settings
        self.model_gateway = model_gateway or (ModelGateway(settings) if settings is not None else None)
        self.tool_runtime_service = tool_runtime_service
        self.temporal_workflow_client = temporal_workflow_client
        self.agent_runtime_engine_name = normalize_agent_runtime_engine_name(
            getattr(settings, "agent_runtime_engine", "native") if settings is not None else "native"
        )
        self.agent_runtime_engine = build_agent_runtime_engine(
            settings,
            engine_name=self.agent_runtime_engine_name,
        )
        self.runtime_binding_resolver = (
            RuntimeBindingResolver(model_endpoint_repository, settings)
            if model_endpoint_repository is not None and settings is not None
            else None
        )

    async def create_agent_execution(
        self,
        request: AgentExecutionCreateRequest,
        *,
        actor: RequestActor,
        existing_execution_id: UUID | None = None,
    ) -> AgentExecutionResponse:
        agent_definition = await self.agent_repository.get_agent_definition(
            agent_definition_id=request.agent_definition_id,
            tenant_id=request.tenant_id,
        )
        if agent_definition is None:
            raise ResourceNotFoundError("Agent definition not found in the current tenant scope.")

        resolved_scope = await self._resolve_agent_scope(agent_definition)
        runtime_binding = (
            await self.runtime_binding_resolver.resolve_chat_runtime_binding(agent_definition=agent_definition)
            if self.runtime_binding_resolver is not None
            else None
        )
        tool_runtime_summary = (
            await self.tool_runtime_service.execute_bound_tools(
                agent_definition=agent_definition,
                tenant_id=request.tenant_id,
                workspace_id=resolved_scope.workspace_id,
                knowledge_base_id=resolved_scope.knowledge_base_id,
                execution_input=request.execution_input.strip() if request.execution_input else None,
                actor=actor,
            )
            if self.tool_runtime_service is not None
            else None
        )
        if existing_execution_id is not None:
            agent_execution = await self.agent_execution_repository.get_agent_execution(
                agent_execution_id=existing_execution_id,
                tenant_id=request.tenant_id,
            )
            if agent_execution is None:
                raise ResourceNotFoundError("Agent execution not found in the current tenant scope.")
            if agent_execution.execution_status == "cancelled":
                return build_agent_execution_response(agent_execution)
        else:
            agent_execution = await self.agent_execution_repository.create_agent_execution(
                tenant_id=request.tenant_id,
                agent_definition_id=request.agent_definition_id,
                workspace_id=resolved_scope.workspace_id,
                knowledge_base_id=resolved_scope.knowledge_base_id,
                execution_mode=agent_definition.agent_mode,
                execution_status="queued",
                trigger_source=request.trigger_source,
                knowledge_base_scope=agent_definition.knowledge_base_scope,
                model_endpoint_id=agent_definition.model_endpoint_id,
                tool_registration_ids=list(agent_definition.tool_registration_ids_json or []),
                execution_input=request.execution_input.strip() if request.execution_input else None,
                launched_by_user_id=actor.user_id,
            )

        agent_execution = await self.agent_execution_repository.mark_agent_execution_running(
            agent_execution=agent_execution
        )

        try:
            summary, result_payload_json = await self.agent_runtime_engine.execute(
                service=self,
                agent_definition=agent_definition,
                resolved_scope=resolved_scope,
                execution_input=request.execution_input.strip() if request.execution_input else None,
                runtime_binding=runtime_binding,
                tool_runtime_summary=tool_runtime_summary,
            )
            runtime_resolution = (
                result_payload_json.get("agent_runtime_resolution")
                if isinstance(result_payload_json.get("agent_runtime_resolution"), dict)
                else {}
            )
            configured_engine = self.agent_runtime_engine_name
            payload_engine = result_payload_json.get("agent_runtime_engine")
            executed_engine = normalize_agent_runtime_engine_name(
                payload_engine if isinstance(payload_engine, str) and payload_engine.strip() else configured_engine
            )
            fallback_reason = (
                runtime_resolution.get("fallback_reason")
                if isinstance(runtime_resolution.get("fallback_reason"), str)
                and str(runtime_resolution.get("fallback_reason")).strip()
                else None
            )
            result_payload_json = {
                **result_payload_json,
                "agent_runtime_engine": executed_engine,
                "configured_agent_runtime_engine": configured_engine,
                "agent_runtime_resolution": {
                    "configured_engine": configured_engine,
                    "executed_engine": executed_engine,
                    "fallback_applied": (
                        bool(runtime_resolution.get("fallback_applied"))
                        or executed_engine != configured_engine
                        or bool(runtime_binding.fallback_applied if runtime_binding is not None else False)
                    ),
                    "fallback_reason": (
                        fallback_reason
                        or (runtime_binding.fallback_reason if runtime_binding is not None else None)
                    ),
                    "configured_model_endpoint_id": (
                        str(runtime_binding.configured_model_endpoint_id)
                        if runtime_binding is not None and runtime_binding.configured_model_endpoint_id is not None
                        else None
                    ),
                    "configured_model_endpoint_name": (
                        runtime_binding.configured_model_endpoint_name if runtime_binding is not None else None
                    ),
                },
            }
            result_payload_json = self._ensure_recommended_action_specs(
                result_payload_json,
                execution_mode=agent_definition.agent_mode,
            )
            agent_execution = await self.agent_execution_repository.complete_agent_execution(
                agent_execution=agent_execution,
                summary=summary,
                result_payload_json=sanitize_json_value(result_payload_json),
            )
        except Exception as error:
            agent_execution = await self.agent_execution_repository.fail_agent_execution(
                agent_execution=agent_execution,
                error_message=str(error),
                result_payload_json={
                    "agent_status": agent_definition.agent_status,
                    "knowledge_base_scope": agent_definition.knowledge_base_scope,
                    "scope_issue": resolved_scope.scope_issue,
                    "agent_runtime_engine": self.agent_runtime_engine_name,
                    "configured_agent_runtime_engine": self.agent_runtime_engine_name,
                    "agent_runtime_resolution": {
                        "configured_engine": self.agent_runtime_engine_name,
                        "executed_engine": self.agent_runtime_engine_name,
                        "fallback_applied": False,
                        "fallback_reason": None,
                    },
                },
            )

        return build_agent_execution_response(agent_execution)

    async def queue_agent_execution(
        self,
        request: AgentExecutionCreateRequest,
        *,
        actor: RequestActor,
        retry_of_execution_id: UUID | None = None,
    ) -> AgentExecutionResponse:
        if self.temporal_workflow_client is None:
            raise RuntimeError("Agent execution Temporal client is not configured.")
        agent_definition = await self.agent_repository.get_agent_definition(
            agent_definition_id=request.agent_definition_id,
            tenant_id=request.tenant_id,
        )
        if agent_definition is None:
            raise ResourceNotFoundError("Agent definition not found in the current tenant scope.")
        resolved_scope = await self._resolve_agent_scope(agent_definition)
        execution = await self.agent_execution_repository.create_agent_execution(
            tenant_id=request.tenant_id,
            agent_definition_id=request.agent_definition_id,
            workspace_id=resolved_scope.workspace_id,
            knowledge_base_id=resolved_scope.knowledge_base_id,
            execution_mode=agent_definition.agent_mode,
            execution_status="queued",
            trigger_source=request.trigger_source,
            knowledge_base_scope=agent_definition.knowledge_base_scope,
            model_endpoint_id=agent_definition.model_endpoint_id,
            tool_registration_ids=list(agent_definition.tool_registration_ids_json or []),
            execution_input=request.execution_input.strip() if request.execution_input else None,
            launched_by_user_id=actor.user_id,
            retry_of_execution_id=retry_of_execution_id,
        )
        workflow_id = await self.temporal_workflow_client.start_agent_execution_workflow(
            agent_execution_id=str(execution.id), tenant_id=str(request.tenant_id),
            actor_user_id=str(actor.user_id) if actor.user_id else None, actor_role=actor.role or "member",
        )
        execution = await self.agent_execution_repository.attach_temporal_workflow(
            agent_execution=execution, temporal_workflow_id=workflow_id,
        )
        return build_agent_execution_response(execution)

    async def cancel_agent_execution(self, *, execution_id: UUID, tenant_id: UUID) -> AgentExecutionResponse:
        execution = await self.agent_execution_repository.get_agent_execution(
            agent_execution_id=execution_id, tenant_id=tenant_id,
        )
        if execution is None:
            raise ResourceNotFoundError("Agent execution not found in the current tenant scope.")
        if execution.execution_status not in {"queued", "running"}:
            return build_agent_execution_response(execution)
        await self.agent_execution_repository.request_agent_execution_cancellation(agent_execution=execution)
        if execution.temporal_workflow_id and self.temporal_workflow_client is not None:
            await self.temporal_workflow_client.cancel_workflow(
                temporal_workflow_id=execution.temporal_workflow_id,
                reason="Agent execution cancelled by an operator.",
            )
        execution = await self.agent_execution_repository.cancel_agent_execution(agent_execution=execution)
        return build_agent_execution_response(execution)

    async def retry_agent_execution(
        self, *, execution_id: UUID, tenant_id: UUID, actor: RequestActor,
    ) -> AgentExecutionResponse:
        execution = await self.agent_execution_repository.get_agent_execution(
            agent_execution_id=execution_id, tenant_id=tenant_id,
        )
        if execution is None:
            raise ResourceNotFoundError("Agent execution not found in the current tenant scope.")
        if execution.execution_status not in {"failed", "cancelled"}:
            raise RuntimeError("Only failed or cancelled agent executions can be retried.")
        return await self.queue_agent_execution(
            AgentExecutionCreateRequest(
                tenant_id=tenant_id, agent_definition_id=execution.agent_definition_id,
                execution_input=execution.execution_input, trigger_source=execution.trigger_source,
            ), actor=actor, retry_of_execution_id=execution.id,
        )

    def _build_mode_recommended_action_specs(
        self,
        *,
        execution_mode: str,
        payload: dict[str, Any],
    ) -> list[RecommendedActionSpec]:
        retrieval_result_count = payload.get("retrieval_result_count")
        no_grounded_evidence = execution_mode == "grounded_chat" and int(retrieval_result_count or 0) <= 0

        if execution_mode == "grounded_chat":
            actions = [
                RecommendedActionSpec(
                    action_key="resume_grounded_chat",
                    action_label="Resume the most relevant grounded conversation in workspace chat.",
                    target_view="chat",
                    action_category="continue",
                    priority="secondary" if no_grounded_evidence else "primary",
                    handoff_intent="grounded_validation",
                ),
                RecommendedActionSpec(
                    action_key="review_evidence",
                    action_label="Review citation coverage before answering high-confidence questions.",
                    target_view="documents",
                    action_category="validation",
                    priority="primary" if no_grounded_evidence else "secondary",
                    handoff_intent="grounded_validation",
                ),
                RecommendedActionSpec(
                    action_key="recover_missing_evidence",
                    action_label="Escalate missing evidence back into document intake when retrieval-ready volume is low.",
                    target_view="workflows",
                    action_category="recovery",
                    handoff_intent="document_recovery",
                    workflow_status="failed",
                ),
            ]
        elif execution_mode == "document_intake":
            actions = [
                RecommendedActionSpec(
                    action_key="review_failed_documents",
                    action_label="Open failed documents first and confirm whether reindex is required.",
                    target_view="documents",
                    action_category="recovery",
                    priority="primary",
                    handoff_intent="document_recovery",
                    document_status="failed",
                ),
                RecommendedActionSpec(
                    action_key="review_active_intake",
                    action_label="Review active intake items before publishing new knowledge-base changes.",
                    target_view="documents",
                    action_category="continue",
                    handoff_intent="agent_brief",
                    document_status="running",
                ),
                RecommendedActionSpec(
                    action_key="inspect_workflow_recovery",
                    action_label="Escalate persistent indexing failures into workflow operations.",
                    target_view="workflows",
                    action_category="recovery",
                    handoff_intent="document_recovery",
                    workflow_status="failed",
                ),
            ]
        else:
            actions = [
                RecommendedActionSpec(
                    action_key="triage_failed_workflows",
                    action_label="Triage the failed queue before retrying any execution chain.",
                    target_view="workflows",
                    action_category="recovery",
                    priority="primary",
                    handoff_intent="workflow_recovery",
                    workflow_status="failed",
                ),
                RecommendedActionSpec(
                    action_key="inspect_retry_lineage",
                    action_label="Inspect retry lineage when repeated document-ingestion failures are visible.",
                    target_view="workflows",
                    action_category="recovery",
                    handoff_intent="workflow_recovery",
                    workflow_status="failed",
                ),
                RecommendedActionSpec(
                    action_key="return_to_documents",
                    action_label="Return to document operations when source cleanup is required before retry.",
                    target_view="documents",
                    action_category="recovery",
                    handoff_intent="document_recovery",
                    document_status="failed",
                ),
            ]

        return actions

    def _build_governance_recommended_action_specs(
        self,
        *,
        payload: dict[str, Any],
    ) -> list[RecommendedActionSpec]:
        actions: list[RecommendedActionSpec] = []

        runtime_resolution = payload.get("agent_runtime_resolution")
        if isinstance(runtime_resolution, dict) and runtime_resolution.get("fallback_applied"):
            configured_model_endpoint_id = runtime_resolution.get("configured_model_endpoint_id")
            if isinstance(configured_model_endpoint_id, str) and configured_model_endpoint_id.strip():
                actions.append(
                    RecommendedActionSpec(
                        action_key="review_model_runtime",
                        action_label="Review model runtime fallback before relying on this execution path.",
                        target_surface="settings",
                        action_category="governance",
                        priority="primary",
                        model_endpoint_id=configured_model_endpoint_id.strip(),
                    )
                )

        tool_runtime = payload.get("tool_runtime")
        if isinstance(tool_runtime, dict):
            traces = tool_runtime.get("traces")
            if isinstance(traces, list):
                first_governance_trace = next(
                    (
                        trace
                        for trace in traces
                        if isinstance(trace, dict)
                        and isinstance(trace.get("tool_registration_id"), str)
                        and isinstance(trace.get("governance_issue"), str)
                    ),
                    None,
                )
                if isinstance(first_governance_trace, dict):
                    governance_issue = first_governance_trace.get("governance_issue")
                    tool_registration_id = first_governance_trace.get("tool_registration_id")
                    response_metadata = (
                        first_governance_trace.get("response_metadata")
                        if isinstance(first_governance_trace.get("response_metadata"), dict)
                        else {}
                    )
                    request_metadata = (
                        first_governance_trace.get("request_metadata")
                        if isinstance(first_governance_trace.get("request_metadata"), dict)
                        else {}
                    )
                    connector_reference = None
                    for source in (response_metadata, request_metadata):
                        candidate = source.get("connector_reference")
                        if isinstance(candidate, str) and candidate.strip():
                            connector_reference = candidate.strip()
                            break
                    if isinstance(governance_issue, str) and isinstance(tool_registration_id, str):
                        issue_mapping = {
                            "approval_required": (
                                "review_tool_approval",
                                "Review tool approval requirements before retrying this execution.",
                            ),
                            "tool_disabled": (
                                "review_disabled_tool",
                                "Review the disabled tool binding before relying on this execution path.",
                            ),
                            "mcp_reserved": (
                                "review_reserved_mcp_tool",
                                "Review the reserved MCP tool boundary before expanding this execution path.",
                            ),
                            "mcp_integration_pending": (
                                "review_mcp_connector_integration",
                                "Review the MCP connector integration posture before relying on this execution path.",
                            ),
                            "endpoint_failure": (
                                "review_tool_endpoint",
                                "Review the failing tool endpoint before trusting this execution route.",
                            ),
                            "runtime_failure": (
                                "review_tool_runtime",
                                "Review tool runtime failures before retrying this execution.",
                            ),
                        }
                        issue_action = issue_mapping.get(governance_issue)
                        if issue_action is not None:
                            actions.append(
                                RecommendedActionSpec(
                                    action_key=issue_action[0],
                                    action_label=issue_action[1],
                                    target_surface="settings",
                                    action_category="governance",
                                    priority="primary",
                                    tool_registration_id=tool_registration_id.strip(),
                                    mcp_connector_slug=connector_reference,
                                )
                            )

        retrieval_result_count = payload.get("retrieval_result_count")
        retrieval_profile_id = payload.get("retrieval_profile_id")
        if (
            isinstance(retrieval_profile_id, str)
            and retrieval_profile_id.strip()
            and int(retrieval_result_count or 0) <= 0
        ):
            actions.append(
                RecommendedActionSpec(
                    action_key="review_retrieval_profile",
                    action_label="Review retrieval-profile posture before treating this knowledge scope as answer-ready.",
                    target_surface="settings",
                    action_category="governance",
                    retrieval_profile_id=retrieval_profile_id.strip(),
                )
            )

        unique_actions: list[RecommendedActionSpec] = []
        seen_keys: set[tuple[str, str, str, str, str]] = set()
        for action in actions:
            action_token = (
                action.action_key,
                action.model_endpoint_id or "",
                action.tool_registration_id or "",
                action.retrieval_profile_id or "",
                action.mcp_connector_slug or "",
            )
            if action_token in seen_keys:
                continue
            seen_keys.add(action_token)
            unique_actions.append(action)

        return unique_actions

    def _build_recommended_action_specs(
        self,
        *,
        execution_mode: str,
        payload: dict[str, Any],
    ) -> list[dict[str, Any]]:
        governance_actions = self._build_governance_recommended_action_specs(payload=payload)
        mode_actions = self._build_mode_recommended_action_specs(
            execution_mode=execution_mode,
            payload=payload,
        )
        return [action.to_json() for action in [*governance_actions, *mode_actions]]

    def _ensure_recommended_action_specs(
        self,
        payload: dict[str, Any],
        *,
        execution_mode: str,
    ) -> dict[str, Any]:
        existing_specs = payload.get("recommended_action_specs")
        if isinstance(existing_specs, list) and len(existing_specs) > 0:
            return payload

        return {
            **payload,
            "recommended_action_specs": self._build_recommended_action_specs(
                execution_mode=execution_mode,
                payload=payload,
            ),
        }

    async def list_agent_executions(
        self,
        *,
        tenant_id: UUID,
        agent_definition_id: UUID | None = None,
        execution_mode: str | None = None,
        execution_status: str | None = None,
        limit: int = 20,
    ) -> list[AgentExecutionResponse]:
        agent_executions = await self.agent_execution_repository.list_agent_executions(
            tenant_id=tenant_id,
            agent_definition_id=agent_definition_id,
            execution_mode=execution_mode,
            execution_status=execution_status,
            limit=limit,
        )
        return [build_agent_execution_response(agent_execution) for agent_execution in agent_executions]

    async def get_agent_execution_metrics(
        self,
        *,
        tenant_id: UUID,
        agent_definition_id: UUID | None = None,
        execution_mode: str | None = None,
        execution_status: str | None = None,
    ) -> AgentExecutionMetricsResponse:
        agent_executions = await self.agent_execution_repository.list_agent_executions_for_metrics(
            tenant_id=tenant_id,
            agent_definition_id=agent_definition_id,
            execution_mode=execution_mode,
            execution_status=execution_status,
        )
        latest_execution_at = max((item.created_at for item in agent_executions), default=None)
        return AgentExecutionMetricsResponse(
            total_executions=len(agent_executions),
            queued_executions=sum(1 for item in agent_executions if item.execution_status == "queued"),
            running_executions=sum(1 for item in agent_executions if item.execution_status == "running"),
            completed_executions=sum(1 for item in agent_executions if item.execution_status == "completed"),
            failed_executions=sum(1 for item in agent_executions if item.execution_status == "failed"),
            latest_execution_at=latest_execution_at,
        )

    async def _resolve_agent_scope(self, agent_definition: AgentDefinition) -> ResolvedAgentScope:
        normalized_scope = (agent_definition.knowledge_base_scope or "").strip()
        if normalized_scope == "":
            return ResolvedAgentScope(workspace_id=None, knowledge_base_id=None, scope_issue="scope_missing")

        workspace_slug, separator, knowledge_base_slug = normalized_scope.partition("/")
        if separator == "" or workspace_slug.strip() == "" or knowledge_base_slug.strip() == "":
            return ResolvedAgentScope(workspace_id=None, knowledge_base_id=None, scope_issue="scope_invalid")

        workspace = await self.workspace_repository.get_workspace_by_slug(
            tenant_id=agent_definition.tenant_id,
            slug=workspace_slug.strip(),
        )
        if workspace is None:
            return ResolvedAgentScope(workspace_id=None, knowledge_base_id=None, scope_issue="scope_invalid")

        knowledge_base = await self.knowledge_base_repository.get_knowledge_base_by_slug(
            workspace_id=workspace.id,
            slug=knowledge_base_slug.strip(),
        )
        if knowledge_base is None:
            return ResolvedAgentScope(workspace_id=workspace.id, knowledge_base_id=None, scope_issue="scope_invalid")

        return ResolvedAgentScope(
            workspace_id=workspace.id,
            knowledge_base_id=knowledge_base.id,
            scope_issue=None,
        )

    async def build_native_execution_result(
        self,
        *,
        agent_definition: AgentDefinition,
        resolved_scope: ResolvedAgentScope,
        execution_input: str | None,
        runtime_binding,
        tool_runtime_summary,
    ) -> tuple[str, dict]:
        if agent_definition.agent_status != "active":
            raise ValueError("Agent execution requires an active agent definition.")

        requires_scope = agent_definition.agent_mode in {"grounded_chat", "document_intake"}
        if requires_scope and (
            resolved_scope.workspace_id is None or resolved_scope.knowledge_base_id is None
        ):
            raise ValueError("Agent execution requires a valid workspace and knowledge base scope.")

        if agent_definition.agent_mode == "grounded_chat":
            return await self._build_grounded_chat_result(
                agent_definition=agent_definition,
                resolved_scope=resolved_scope,
                execution_input=execution_input,
                runtime_binding=runtime_binding,
                tool_runtime_summary=tool_runtime_summary,
            )

        if agent_definition.agent_mode == "document_intake":
            return await self._build_document_intake_result(
                agent_definition=agent_definition,
                resolved_scope=resolved_scope,
                execution_input=execution_input,
                runtime_binding=runtime_binding,
                tool_runtime_summary=tool_runtime_summary,
            )

        return await self._build_workflow_recovery_result(
            agent_definition=agent_definition,
            execution_input=execution_input,
            runtime_binding=runtime_binding,
            tool_runtime_summary=tool_runtime_summary,
        )

    async def _build_grounded_chat_result(
        self,
        *,
        agent_definition: AgentDefinition,
        resolved_scope: ResolvedAgentScope,
        execution_input: str | None,
        runtime_binding,
        tool_runtime_summary,
    ) -> tuple[str, dict]:
        assert resolved_scope.workspace_id is not None
        assert resolved_scope.knowledge_base_id is not None

        conversation_metrics = await self.conversation_repository.get_conversation_metrics(
            tenant_id=agent_definition.tenant_id,
            workspace_id=resolved_scope.workspace_id,
        )
        document_metrics = await self.document_repository.get_document_metrics(
            knowledge_base_id=resolved_scope.knowledge_base_id
        )
        query_text = (
            execution_input
            or agent_definition.objective.strip()
            or "Prepare a grounded overview for the current knowledge base scope."
        )
        answer_preview = None
        retrieval_outcome = None
        retrieval_results: list[dict] = []
        if self.retrieval_repository is not None and self.settings is not None and self.model_gateway is not None:
            retrieval_outcome = await execute_retrieval(
                retrieval_repository=self.retrieval_repository,
                settings=self.settings,
                tenant_id=agent_definition.tenant_id,
                knowledge_base_id=resolved_scope.knowledge_base_id,
                query_text=query_text,
                requested_top_k=3,
                knowledge_base_repository=self.knowledge_base_repository,
                retrieval_profile_repository=self.retrieval_profile_repository,
            )
            retrieval_results = retrieval_outcome.results
            generation = await self.model_gateway.generate_grounded_answer(
                question=query_text,
                retrieval_results=retrieval_results,
                runtime_binding=runtime_binding,
                agent_name=agent_definition.name,
                agent_mode=agent_definition.agent_mode,
                agent_objective=agent_definition.objective,
                agent_instructions=agent_definition.instructions,
                knowledge_base_scope=agent_definition.knowledge_base_scope,
            )
            answer_preview = generation.content

        summary = (
            f"{agent_definition.name} prepared a grounded runtime briefing for "
            f"{document_metrics['completed_documents']} retrieval-ready documents and "
            f"{conversation_metrics['active_conversations']} active conversations."
        )
        return summary, {
            "execution_lane": "grounded_chat",
            "agent_status": agent_definition.agent_status,
            "objective": agent_definition.objective,
            "knowledge_base_scope": agent_definition.knowledge_base_scope,
            "runtime_binding": runtime_binding.to_usage_json() if runtime_binding is not None else None,
            "tool_runtime": tool_runtime_summary.model_dump() if tool_runtime_summary is not None else None,
            "retrieval_engine": normalize_retrieval_engine_name(
                getattr(self.settings, "retrieval_engine", "native") if self.settings is not None else "native"
            ),
            "retrieval_profile_id": str(retrieval_outcome.retrieval_profile_id) if retrieval_outcome and retrieval_outcome.retrieval_profile_id else None,
            "retrieval_profile_name": retrieval_outcome.retrieval_profile_name if retrieval_outcome else None,
            "retrieval_profile_source": retrieval_outcome.retrieval_profile_source if retrieval_outcome else None,
            "retrieval_mode": retrieval_outcome.retrieval_mode if retrieval_outcome else "hybrid",
            "retrieval_effective_top_k": retrieval_outcome.effective_top_k if retrieval_outcome else 3,
            "conversation_metrics": conversation_metrics,
            "document_metrics": document_metrics,
            "answer_preview": answer_preview,
            "retrieval_result_count": len(retrieval_results),
            "retrieval_results": [
                {
                    "document_chunk_id": str(row["document_chunk_id"]),
                    "document_id": str(row["document_id"]) if row.get("document_id") is not None else None,
                    "document_version_id": str(row["document_version_id"]) if row.get("document_version_id") is not None else None,
                    "document_title": row.get("document_title"),
                    "chunk_index": row.get("chunk_index"),
                    "retrieval_method": row.get("retrieval_method"),
                    "score": float(row["score"]) if row.get("score") is not None else None,
                }
                for row in retrieval_results
            ],
            "recommended_actions": [
                "Resume the most relevant grounded conversation in workspace chat.",
                "Review citation coverage before answering high-confidence questions.",
                "Escalate missing evidence back into document intake when retrieval-ready volume is low.",
            ],
            "execution_input": query_text,
        }

    async def _build_document_intake_result(
        self,
        *,
        agent_definition: AgentDefinition,
        resolved_scope: ResolvedAgentScope,
        execution_input: str | None,
        runtime_binding,
        tool_runtime_summary,
    ) -> tuple[str, dict]:
        assert resolved_scope.knowledge_base_id is not None

        document_metrics = await self.document_repository.get_document_metrics(
            knowledge_base_id=resolved_scope.knowledge_base_id
        )
        recent_documents, total_documents = await self.document_repository.list_documents(
            knowledge_base_id=resolved_scope.knowledge_base_id,
            status_filter="all",
            sort_order="created-desc",
            limit=3,
            offset=0,
        )
        summary = (
            f"{agent_definition.name} reviewed intake posture across {total_documents} documents "
            f"with {document_metrics['active_documents']} still in processing and "
            f"{document_metrics['failed_documents']} requiring recovery."
        )
        return summary, {
            "execution_lane": "document_intake",
            "agent_status": agent_definition.agent_status,
            "objective": agent_definition.objective,
            "knowledge_base_scope": agent_definition.knowledge_base_scope,
            "runtime_binding": runtime_binding.to_usage_json() if runtime_binding is not None else None,
            "tool_runtime": tool_runtime_summary.model_dump() if tool_runtime_summary is not None else None,
            "document_metrics": document_metrics,
            "recent_documents": [
                {
                    "id": str(document.id),
                    "title": document.title,
                    "ingestion_status": document.ingestion_status,
                    "indexing_status": document.indexing_status,
                }
                for document in recent_documents
            ],
            "recommended_actions": [
                "Open failed documents first and confirm whether reindex is required.",
                "Review active intake items before publishing new knowledge-base changes.",
                "Escalate persistent indexing failures into workflow operations.",
            ],
            "execution_input": execution_input,
        }

    async def _build_workflow_recovery_result(
        self,
        *,
        agent_definition: AgentDefinition,
        execution_input: str | None,
        runtime_binding,
        tool_runtime_summary,
    ) -> tuple[str, dict]:
        workflow_metrics, failed_runs = await self.collect_workflow_recovery_context(
            agent_definition=agent_definition
        )
        return self.build_workflow_recovery_result_from_context(
            agent_definition=agent_definition,
            execution_input=execution_input,
            runtime_binding=runtime_binding,
            tool_runtime_summary=tool_runtime_summary,
            workflow_metrics=workflow_metrics,
            failed_runs=failed_runs,
        )

    async def collect_workflow_recovery_context(
        self,
        *,
        agent_definition: AgentDefinition,
    ) -> tuple[dict[str, Any], list[Any]]:
        workflow_metrics = await self.workflow_repository.get_workflow_metrics(
            tenant_id=agent_definition.tenant_id
        )
        failed_runs, _ = await self.workflow_repository.list_workflow_runs(
            tenant_id=agent_definition.tenant_id,
            status_filter="failed",
            sort_order="updated-desc",
            limit=3,
            offset=0,
        )
        return workflow_metrics, list(failed_runs)

    def build_workflow_recovery_result_from_context(
        self,
        *,
        agent_definition: AgentDefinition,
        execution_input: str | None,
        runtime_binding,
        tool_runtime_summary,
        workflow_metrics: dict[str, Any],
        failed_runs: list[Any],
        runtime_metadata: dict[str, Any] | None = None,
    ) -> tuple[str, dict]:
        summary = (
            f"{agent_definition.name} reviewed workflow pressure with "
            f"{workflow_metrics['failed_runs']} failed runs, "
            f"{workflow_metrics['queued_runs']} queued runs, and "
            f"{workflow_metrics['retry_runs']} retry-derived runs."
        )
        payload = {
            "execution_lane": "workflow_recovery",
            "agent_status": agent_definition.agent_status,
            "objective": agent_definition.objective,
            "runtime_binding": runtime_binding.to_usage_json() if runtime_binding is not None else None,
            "tool_runtime": tool_runtime_summary.model_dump() if tool_runtime_summary is not None else None,
            "workflow_metrics": workflow_metrics,
            "recent_failed_runs": [
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
            "recommended_actions": [
                "Triage the failed queue before retrying any execution chain.",
                "Inspect retry lineage when repeated document-ingestion failures are visible.",
                "Return to document operations when source cleanup is required before retry.",
            ],
            "execution_input": execution_input,
        }
        if runtime_metadata:
            payload.update(runtime_metadata)
        return summary, payload


def build_agent_execution_response(agent_execution: AgentExecution) -> AgentExecutionResponse:
    generated_outputs = build_agent_execution_outputs(agent_execution)
    return AgentExecutionResponse(
        id=agent_execution.id,
        tenant_id=agent_execution.tenant_id,
        agent_definition_id=agent_execution.agent_definition_id,
        workspace_id=agent_execution.workspace_id,
        knowledge_base_id=agent_execution.knowledge_base_id,
        execution_mode=agent_execution.execution_mode,
        execution_status=agent_execution.execution_status,
        trigger_source=agent_execution.trigger_source,
        knowledge_base_scope=agent_execution.knowledge_base_scope,
        model_endpoint_id=agent_execution.model_endpoint_id,
        tool_registration_ids=[UUID(tool_registration_id) for tool_registration_id in list(agent_execution.tool_registration_ids_json or [])],
        execution_input=agent_execution.execution_input,
        summary=agent_execution.summary,
        result_payload_json=dict(agent_execution.result_payload_json or {}),
        task_state=build_agent_execution_task_state(agent_execution, output_count=len(generated_outputs)),
        generated_outputs=generated_outputs,
        error_message=agent_execution.error_message,
        launched_by_user_id=agent_execution.launched_by_user_id,
        started_at=agent_execution.started_at,
        completed_at=agent_execution.completed_at,
        temporal_workflow_id=getattr(agent_execution, "temporal_workflow_id", None),
        retry_of_execution_id=getattr(agent_execution, "retry_of_execution_id", None),
        cancellation_requested_at=getattr(agent_execution, "cancellation_requested_at", None),
        cancelled_at=getattr(agent_execution, "cancelled_at", None),
        created_at=agent_execution.created_at,
        updated_at=agent_execution.updated_at,
    )


def build_agent_execution_task_state(
    agent_execution: AgentExecution,
    *,
    output_count: int,
) -> AgentExecutionTaskStateResponse | None:
    payload = dict(agent_execution.result_payload_json or {})
    lane = payload.get("execution_lane")
    resolved_lane = lane if lane in {"grounded_chat", "document_intake", "workflow_recovery"} else agent_execution.execution_mode

    if resolved_lane not in {"grounded_chat", "document_intake", "workflow_recovery"}:
        return None

    recommended_action_count = len(payload.get("recommended_action_specs") or payload.get("recommended_actions") or [])
    tool_runtime = payload.get("tool_runtime") if isinstance(payload.get("tool_runtime"), dict) else {}
    tool_traces = tool_runtime.get("traces") if isinstance(tool_runtime.get("traces"), list) else []
    retrieval_result_count = _read_int(payload.get("retrieval_result_count"))
    runtime_resolution = (
        payload.get("agent_runtime_resolution")
        if isinstance(payload.get("agent_runtime_resolution"), dict)
        else {}
    )
    fallback_applied = bool(runtime_resolution.get("fallback_applied"))
    duration_seconds = None
    if agent_execution.started_at is not None and agent_execution.completed_at is not None:
        duration_seconds = max(
            int((agent_execution.completed_at - agent_execution.started_at).total_seconds()),
            0,
        )

    if agent_execution.execution_status == "failed":
        stage_key = "execution_failed"
    elif agent_execution.execution_status == "queued":
        stage_key = "queued_for_execution"
    elif agent_execution.execution_status == "running":
        stage_key = "running_execution"
    elif resolved_lane == "grounded_chat" and isinstance(payload.get("answer_preview"), str) and payload.get("answer_preview"):
        stage_key = "grounded_answer_ready"
    elif resolved_lane == "document_intake" and isinstance(payload.get("document_metrics"), dict):
        stage_key = "intake_review_ready"
    elif resolved_lane == "workflow_recovery" and isinstance(payload.get("workflow_metrics"), dict):
        stage_key = "recovery_brief_ready"
    else:
        stage_key = "execution_completed"

    return AgentExecutionTaskStateResponse(
        lane=resolved_lane,
        stage_key=stage_key,
        output_count=output_count,
        recommended_action_count=max(recommended_action_count, 0),
        tool_trace_count=len(tool_traces),
        retrieval_result_count=retrieval_result_count,
        fallback_applied=fallback_applied,
        duration_seconds=duration_seconds,
    )


def build_agent_execution_outputs(agent_execution: AgentExecution) -> list[AgentExecutionOutputResponse]:
    payload = dict(agent_execution.result_payload_json or {})
    outputs: list[AgentExecutionOutputResponse] = []

    answer_preview = payload.get("answer_preview")
    if isinstance(answer_preview, str) and answer_preview.strip():
        retrieval_result_count = _read_int(payload.get("retrieval_result_count"))
        outputs.append(
            AgentExecutionOutputResponse(
                output_key="answer_preview",
                kind="answer_preview",
                status="ready",
                metric_value=(
                    f"{retrieval_result_count} sources"
                    if retrieval_result_count is not None
                    else None
                ),
                preview=answer_preview.strip(),
            )
        )

    retrieval_results = payload.get("retrieval_results") if isinstance(payload.get("retrieval_results"), list) else []
    if retrieval_results:
        retrieval_result_count = _read_int(payload.get("retrieval_result_count")) or len(retrieval_results)
        retrieval_methods = sorted(
            {
                str(result.get("retrieval_method")).strip()
                for result in retrieval_results
                if isinstance(result, dict)
                and isinstance(result.get("retrieval_method"), str)
                and str(result.get("retrieval_method")).strip()
            }
        )
        outputs.append(
            AgentExecutionOutputResponse(
                output_key="retrieval_evidence",
                kind="retrieval_evidence",
                status="ready" if retrieval_result_count > 0 else "pending",
                metric_value=f"{retrieval_result_count} hits",
                preview=", ".join(retrieval_methods[:3]) if retrieval_methods else None,
            )
        )

    document_metrics = payload.get("document_metrics") if isinstance(payload.get("document_metrics"), dict) else {}
    recent_documents = payload.get("recent_documents") if isinstance(payload.get("recent_documents"), list) else []
    if document_metrics or recent_documents:
        failed_documents = _read_int(document_metrics.get("failed_documents")) or 0
        active_documents = _read_int(document_metrics.get("active_documents")) or 0
        total_documents = _read_int(document_metrics.get("total_documents"))
        status = "attention" if failed_documents > 0 else "pending" if active_documents > 0 else "ready"
        document_titles = [
            str(document.get("title")).strip()
            for document in recent_documents
            if isinstance(document, dict)
            and isinstance(document.get("title"), str)
            and str(document.get("title")).strip()
        ]
        outputs.append(
            AgentExecutionOutputResponse(
                output_key="document_intake",
                kind="document_intake",
                status=status,
                metric_value=(
                    f"{failed_documents} failed"
                    if failed_documents > 0
                    else f"{active_documents} active"
                    if active_documents > 0
                    else f"{total_documents} total"
                    if total_documents is not None
                    else None
                ),
                preview=", ".join(document_titles[:2]) if document_titles else None,
            )
        )

    workflow_metrics = payload.get("workflow_metrics") if isinstance(payload.get("workflow_metrics"), dict) else {}
    recent_failed_runs = payload.get("recent_failed_runs") if isinstance(payload.get("recent_failed_runs"), list) else []
    if workflow_metrics or recent_failed_runs:
        failed_runs = _read_int(workflow_metrics.get("failed_runs")) or 0
        queued_runs = _read_int(workflow_metrics.get("queued_runs")) or 0
        retry_runs = _read_int(workflow_metrics.get("retry_runs")) or 0
        status = "attention" if failed_runs > 0 else "pending" if queued_runs > 0 else "ready"
        run_types = [
            str(workflow_run.get("workflow_type")).strip()
            for workflow_run in recent_failed_runs
            if isinstance(workflow_run, dict)
            and isinstance(workflow_run.get("workflow_type"), str)
            and str(workflow_run.get("workflow_type")).strip()
        ]
        outputs.append(
            AgentExecutionOutputResponse(
                output_key="workflow_recovery",
                kind="workflow_recovery",
                status=status,
                metric_value=(
                    f"{failed_runs} failed"
                    if failed_runs > 0
                    else f"{queued_runs} queued"
                    if queued_runs > 0
                    else f"{retry_runs} retries"
                    if retry_runs > 0
                    else None
                ),
                preview=", ".join(run_types[:2]) if run_types else None,
            )
        )

    tool_runtime = payload.get("tool_runtime") if isinstance(payload.get("tool_runtime"), dict) else {}
    if tool_runtime:
        blocked_tools = _read_int(tool_runtime.get("blocked_tools")) or 0
        failed_tools = _read_int(tool_runtime.get("failed_tools")) or 0
        unavailable_tools = _read_int(tool_runtime.get("unavailable_tools")) or 0
        completed_tools = _read_int(tool_runtime.get("completed_tools")) or 0
        total_bound_tools = _read_int(tool_runtime.get("total_bound_tools")) or 0
        tool_status = (
            "attention"
            if blocked_tools > 0 or failed_tools > 0 or unavailable_tools > 0
            else "ready"
            if completed_tools > 0
            else "pending"
        )
        traces = tool_runtime.get("traces") if isinstance(tool_runtime.get("traces"), list) else []
        first_issue = next(
            (
                str(trace.get("governance_issue")).strip().replace("_", " ")
                for trace in traces
                if isinstance(trace, dict)
                and isinstance(trace.get("governance_issue"), str)
                and str(trace.get("governance_issue")).strip()
            ),
            None,
        )
        outputs.append(
            AgentExecutionOutputResponse(
                output_key="tool_runtime",
                kind="tool_runtime",
                status=tool_status,
                metric_value=(
                    f"{completed_tools}/{total_bound_tools} completed"
                    if total_bound_tools > 0
                    else None
                ),
                preview=first_issue,
            )
        )

    return outputs


def _read_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str) and value.strip():
        try:
            return int(value.strip())
        except ValueError:
            return None
    return None


def sanitize_json_value(value):
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, dict):
        return {key: sanitize_json_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [sanitize_json_value(item) for item in value]
    return value
