from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import httpx
import pytest

from ragpilot_api.application.tool_runtime import tool_runtime_service
from ragpilot_api.application.tool_runtime.tool_runtime_service import ToolRuntimeService


def build_tool_registration(**overrides):
    defaults = {
        "id": uuid4(),
        "name": "Scope Summary",
        "slug": "scope-summary",
        "transport_type": "native",
        "surface_area": "agents",
        "endpoint_url": None,
        "capabilities_json": ["scope_summary"],
        "requires_admin_approval": False,
        "is_enabled": True,
    }
    return SimpleNamespace(**{**defaults, **overrides})


@pytest.mark.anyio
async def test_tool_runtime_service_executes_native_capabilities() -> None:
    tenant_id = uuid4()
    workspace_id = uuid4()
    knowledge_base_id = uuid4()
    tool_registration = build_tool_registration(
        capabilities_json=["scope_summary", "document_metrics"],
    )
    service = ToolRuntimeService(
        tool_registration_repository=SimpleNamespace(
            get_tool_registration=AsyncMock(return_value=tool_registration)
        ),
        conversation_repository=SimpleNamespace(),
        document_repository=SimpleNamespace(
            get_document_metrics=AsyncMock(
                return_value={
                    "total_documents": 5,
                    "active_documents": 1,
                    "completed_documents": 4,
                    "failed_documents": 0,
                    "draft_documents": 0,
                }
            )
        ),
        workflow_repository=SimpleNamespace(),
    )

    result = await service.preview_tool_invocation(
        tool_registration_id=tool_registration.id,
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        knowledge_base_id=knowledge_base_id,
        execution_input="Inspect current scope.",
        actor=SimpleNamespace(role="operator"),
    )

    assert result.invocation_status == "completed"
    assert result.governance_issue is None
    assert result.capability_results["scope_summary"]["tenant_id"] == str(tenant_id)
    assert result.capability_results["document_metrics"]["completed_documents"] == 4


@pytest.mark.anyio
async def test_tool_runtime_service_blocks_approval_gated_tool_for_operator() -> None:
    tool_registration = build_tool_registration(requires_admin_approval=True)
    service = ToolRuntimeService(
        tool_registration_repository=SimpleNamespace(
            get_tool_registration=AsyncMock(return_value=tool_registration)
        ),
        conversation_repository=SimpleNamespace(),
        document_repository=SimpleNamespace(),
        workflow_repository=SimpleNamespace(),
    )

    result = await service.preview_tool_invocation(
        tool_registration_id=tool_registration.id,
        tenant_id=uuid4(),
        workspace_id=None,
        knowledge_base_id=None,
        execution_input=None,
        actor=SimpleNamespace(role="operator"),
    )

    assert result.invocation_status == "blocked"
    assert result.governance_issue == "approval_required"


@pytest.mark.anyio
async def test_tool_runtime_service_marks_ready_mcp_boundary_as_integration_pending() -> None:
    tool_registration = build_tool_registration(
        transport_type="mcp_reserved",
        endpoint_url=None,
        capabilities_json=["browser.navigate"],
        requires_admin_approval=False,
    )
    service = ToolRuntimeService(
        tool_registration_repository=SimpleNamespace(
            get_tool_registration=AsyncMock(return_value=tool_registration)
        ),
        conversation_repository=SimpleNamespace(),
        document_repository=SimpleNamespace(),
        workflow_repository=SimpleNamespace(),
    )

    result = await service.preview_tool_invocation(
        tool_registration_id=tool_registration.id,
        tenant_id=uuid4(),
        workspace_id=None,
        knowledge_base_id=None,
        execution_input="Open the browser tool.",
        actor=SimpleNamespace(role="super_admin"),
    )

    assert result.invocation_status == "unavailable"
    assert result.governance_issue == "mcp_integration_pending"
    assert result.response_metadata["boundary_status"] == "ready_for_integration"
    assert result.response_metadata["connector_attached"] is False


@pytest.mark.anyio
async def test_tool_runtime_service_keeps_reviewing_mcp_boundary_as_reserved() -> None:
    tool_registration = build_tool_registration(
        transport_type="mcp_reserved",
        endpoint_url=None,
        capabilities_json=["browser.navigate"],
        requires_admin_approval=True,
    )
    service = ToolRuntimeService(
        tool_registration_repository=SimpleNamespace(
            get_tool_registration=AsyncMock(return_value=tool_registration)
        ),
        conversation_repository=SimpleNamespace(),
        document_repository=SimpleNamespace(),
        workflow_repository=SimpleNamespace(),
    )

    result = await service.preview_tool_invocation(
        tool_registration_id=tool_registration.id,
        tenant_id=uuid4(),
        workspace_id=None,
        knowledge_base_id=None,
        execution_input="Review the boundary.",
        actor=SimpleNamespace(role="super_admin"),
    )

    assert result.invocation_status == "reserved"
    assert result.governance_issue == "mcp_reserved"
    assert result.response_metadata["boundary_status"] == "reviewing"


@pytest.mark.anyio
async def test_tool_runtime_service_executes_http_transport() -> None:
    tool_registration = build_tool_registration(
        transport_type="http",
        endpoint_url="http://127.0.0.1:18000/tools/search",
        capabilities_json=["search"],
    )

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def post(self, url, json):
            return httpx.Response(
                status_code=200,
                json={
                    "summary": "Search tool completed.",
                    "invocation_status": "completed",
                    "capability_results": {
                        "query": json["execution_input"],
                        "match_count": 2,
                    },
                },
                request=httpx.Request("POST", url),
            )

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(tool_runtime_service.httpx, "AsyncClient", FakeAsyncClient)
    service = ToolRuntimeService(
        tool_registration_repository=SimpleNamespace(
            get_tool_registration=AsyncMock(return_value=tool_registration)
        ),
        conversation_repository=SimpleNamespace(),
        document_repository=SimpleNamespace(),
        workflow_repository=SimpleNamespace(),
    )
    try:
        result = await service.preview_tool_invocation(
            tool_registration_id=tool_registration.id,
            tenant_id=uuid4(),
            workspace_id=None,
            knowledge_base_id=None,
            execution_input="search for ragpilot",
            actor=SimpleNamespace(role="super_admin"),
        )
    finally:
        monkeypatch.undo()

    assert result.invocation_status == "completed"
    assert result.governance_issue is None
    assert result.capability_results["match_count"] == 2
    assert result.request_metadata["attempt_count"] == 1
    assert result.response_metadata["status_code"] == 200


@pytest.mark.anyio
async def test_tool_runtime_service_marks_http_error_as_failed() -> None:
    tool_registration = build_tool_registration(
        transport_type="http",
        endpoint_url="http://127.0.0.1:18000/tools/search",
        capabilities_json=["search"],
    )

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def post(self, url, json):
            return httpx.Response(
                status_code=502,
                json={
                    "summary": "Upstream tool failed.",
                    "error_message": "Upstream unavailable",
                },
                request=httpx.Request("POST", url),
            )

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(tool_runtime_service.httpx, "AsyncClient", FakeAsyncClient)
    service = ToolRuntimeService(
        tool_registration_repository=SimpleNamespace(
            get_tool_registration=AsyncMock(return_value=tool_registration)
        ),
        conversation_repository=SimpleNamespace(),
        document_repository=SimpleNamespace(),
        workflow_repository=SimpleNamespace(),
    )
    try:
        result = await service.preview_tool_invocation(
            tool_registration_id=tool_registration.id,
            tenant_id=uuid4(),
            workspace_id=None,
            knowledge_base_id=None,
            execution_input="search for ragpilot",
            actor=SimpleNamespace(role="super_admin"),
        )
    finally:
        monkeypatch.undo()

    assert result.invocation_status == "failed"
    assert result.governance_issue == "endpoint_failure"
    assert result.error_message == "Upstream unavailable"
    assert result.response_metadata["status_code"] == 502


@pytest.mark.anyio
async def test_tool_runtime_service_retries_retryable_http_status_before_success() -> None:
    tool_registration = build_tool_registration(
        transport_type="http",
        endpoint_url="http://127.0.0.1:18000/tools/search",
        capabilities_json=["search"],
    )
    responses = [
        httpx.Response(
            status_code=503,
            json={
                "summary": "Tool warming up.",
                "error_message": "Try again shortly",
            },
            request=httpx.Request("POST", tool_registration.endpoint_url),
        ),
        httpx.Response(
            status_code=200,
            json={
                "summary": "Search tool completed after retry.",
                "invocation_status": "completed",
                "capability_results": {
                    "match_count": 1,
                },
            },
            request=httpx.Request("POST", tool_registration.endpoint_url),
        ),
    ]

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def post(self, url, json):
            return responses.pop(0)

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(tool_runtime_service.httpx, "AsyncClient", FakeAsyncClient)
    service = ToolRuntimeService(
        tool_registration_repository=SimpleNamespace(
            get_tool_registration=AsyncMock(return_value=tool_registration)
        ),
        conversation_repository=SimpleNamespace(),
        document_repository=SimpleNamespace(),
        workflow_repository=SimpleNamespace(),
        settings=SimpleNamespace(
            tool_runtime_request_timeout_seconds=30,
            tool_runtime_max_attempts=2,
            tool_runtime_retryable_status_code_set={503},
        ),
    )
    try:
        result = await service.preview_tool_invocation(
            tool_registration_id=tool_registration.id,
            tenant_id=uuid4(),
            workspace_id=None,
            knowledge_base_id=None,
            execution_input="search for retry",
            actor=SimpleNamespace(role="super_admin"),
        )
    finally:
        monkeypatch.undo()

    assert result.invocation_status == "completed"
    assert result.governance_issue is None
    assert result.request_metadata["attempt_count"] == 2
    assert result.response_metadata["retried"] is True
    assert result.response_metadata["status_code"] == 200
