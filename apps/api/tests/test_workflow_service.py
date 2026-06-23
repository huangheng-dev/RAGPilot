from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.application.workflows.workflow_service import WorkflowService, resolve_workflow_retry_state


def build_workflow_run(**overrides):
    defaults = {
        "id": uuid4(),
        "tenant_id": uuid4(),
        "workflow_type": "document_ingestion",
        "workflow_status": "failed",
        "temporal_workflow_id": "document-ingestion-example",
        "subject_type": "document",
        "subject_id": uuid4(),
        "input_json": {},
        "error_message": None,
        "started_at": datetime.now(timezone.utc),
        "completed_at": datetime.now(timezone.utc),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    return SimpleNamespace(
        **{
            **defaults,
            **overrides,
        }
    )


@pytest.mark.anyio
async def test_retry_workflow_run_rejects_deleted_source_document() -> None:
    workflow_run = build_workflow_run()
    repository = SimpleNamespace(
        get_workflow_run=AsyncMock(return_value=workflow_run),
        session=AsyncMock(),
    )
    repository.session.execute = AsyncMock(return_value=SimpleNamespace(first=lambda: (uuid4(), datetime.now(timezone.utc))))
    repository.session.commit = AsyncMock()
    document_repository = SimpleNamespace(create_reindex_workflow_run=AsyncMock())

    service = WorkflowService(
        workflow_repository=repository,
        document_repository=document_repository,
    )

    with pytest.raises(
        ResourceConflictError,
        match="Workflow retry is unavailable because the source document has been deleted.",
    ):
        await service.retry_workflow_run(
            workflow_run_id=workflow_run.id,
            tenant_id=workflow_run.tenant_id,
        )

    repository.session.commit.assert_not_awaited()
    document_repository.create_reindex_workflow_run.assert_not_awaited()


@pytest.mark.anyio
async def test_resolve_workflow_retry_state_marks_active_failed_document_runs_as_retryable() -> None:
    workflow_run = build_workflow_run()
    repository = SimpleNamespace(session=AsyncMock())
    repository.session.execute = AsyncMock(return_value=SimpleNamespace(first=lambda: (None,)))

    retry_state = await resolve_workflow_retry_state(repository, workflow_run)

    assert retry_state == {
        "is_retry_available": True,
        "retry_unavailable_reason": None,
    }


@pytest.mark.anyio
async def test_resolve_workflow_retry_state_reports_deleted_source_document() -> None:
    workflow_run = build_workflow_run()
    repository = SimpleNamespace(session=AsyncMock())
    repository.session.execute = AsyncMock(return_value=SimpleNamespace(first=lambda: (datetime.now(timezone.utc),)))

    retry_state = await resolve_workflow_retry_state(repository, workflow_run)

    assert retry_state == {
        "is_retry_available": False,
        "retry_unavailable_reason": "Retry is unavailable because the source document is no longer active in this knowledge base.",
    }


@pytest.mark.anyio
async def test_list_workflow_runs_includes_retry_available_recovery_guidance() -> None:
    workflow_run = build_workflow_run()
    workspace_id = uuid4()
    knowledge_base_id = uuid4()
    repository = SimpleNamespace(
        list_workflow_runs=AsyncMock(return_value=([workflow_run], 1)),
        session=AsyncMock(),
    )
    repository.session.execute = AsyncMock(side_effect=[
        SimpleNamespace(first=lambda: (None,)),
        SimpleNamespace(first=lambda: ("Operator Handbook", workspace_id, knowledge_base_id)),
    ])

    service = WorkflowService(workflow_repository=repository)

    workflow_runs, _ = await service.list_workflow_runs(
        tenant_id=workflow_run.tenant_id,
        sort_order="updated-desc",
        limit=10,
        offset=0,
    )

    assert workflow_runs[0].recovery_stage == "retry_available"
    assert workflow_runs[0].recommended_next_view == "workflows"
    assert workflow_runs[0].recommended_primary_action == "retry_workflow"


@pytest.mark.anyio
async def test_list_workflow_runs_includes_deleted_document_recovery_guidance() -> None:
    workflow_run = build_workflow_run()
    repository = SimpleNamespace(
        list_workflow_runs=AsyncMock(return_value=([workflow_run], 1)),
        session=AsyncMock(),
    )
    repository.session.execute = AsyncMock(side_effect=[
        SimpleNamespace(first=lambda: (datetime.now(timezone.utc),)),
        SimpleNamespace(first=lambda: ("Operator Handbook", uuid4(), uuid4())),
    ])

    service = WorkflowService(workflow_repository=repository)

    workflow_runs, _ = await service.list_workflow_runs(
        tenant_id=workflow_run.tenant_id,
        sort_order="updated-desc",
        limit=10,
        offset=0,
    )

    assert workflow_runs[0].recovery_stage == "retry_blocked_document_deleted"
    assert workflow_runs[0].recommended_next_view == "documents"
    assert workflow_runs[0].recommended_primary_action == "open_document"


@pytest.mark.anyio
async def test_list_workflow_runs_includes_completed_recovery_guidance() -> None:
    workflow_run = build_workflow_run(workflow_status="completed")
    repository = SimpleNamespace(
        list_workflow_runs=AsyncMock(return_value=([workflow_run], 1)),
        session=AsyncMock(),
    )
    repository.session.execute = AsyncMock(return_value=SimpleNamespace(first=lambda: ("Operator Handbook", uuid4(), uuid4())))

    service = WorkflowService(workflow_repository=repository)

    workflow_runs, _ = await service.list_workflow_runs(
        tenant_id=workflow_run.tenant_id,
        sort_order="updated-desc",
        limit=10,
        offset=0,
    )

    assert workflow_runs[0].recovery_stage == "completed_ready_for_chat"
    assert workflow_runs[0].recommended_next_view == "chat"
    assert workflow_runs[0].recommended_primary_action == "open_chat"


@pytest.mark.anyio
async def test_list_workflow_runs_forwards_subject_filter_to_repository() -> None:
    tenant_id = uuid4()
    subject_id = uuid4()
    workflow_run = build_workflow_run(tenant_id=tenant_id, subject_id=subject_id)
    repository = SimpleNamespace(
        list_workflow_runs=AsyncMock(return_value=([workflow_run], 1)),
        session=AsyncMock(),
    )
    repository.session.execute = AsyncMock(return_value=SimpleNamespace(first=lambda: (None,)))

    service = WorkflowService(workflow_repository=repository)

    workflow_runs, total_count = await service.list_workflow_runs(
        tenant_id=tenant_id,
        subject_id=subject_id,
        sort_order="updated-desc",
        limit=10,
        offset=0,
    )

    assert total_count == 1
    assert len(workflow_runs) == 1
    repository.list_workflow_runs.assert_awaited_once_with(
        tenant_id=tenant_id,
        query=None,
        status_filter=None,
        workflow_type=None,
        retry_mode=None,
        subject_id=subject_id,
        sort_order="updated-desc",
        limit=10,
        offset=0,
    )
    assert workflow_runs[0].subject_label is None
    assert workflow_runs[0].subject_workspace_id is None
    assert workflow_runs[0].subject_knowledge_base_id is None


@pytest.mark.anyio
async def test_list_workflow_runs_resolves_document_subject_label() -> None:
    workflow_run = build_workflow_run()
    workspace_id = uuid4()
    knowledge_base_id = uuid4()
    repository = SimpleNamespace(
        list_workflow_runs=AsyncMock(return_value=([workflow_run], 1)),
        session=AsyncMock(),
    )
    repository.session.execute = AsyncMock(side_effect=[
        SimpleNamespace(first=lambda: (None,)),
        SimpleNamespace(first=lambda: ("Operator Handbook", workspace_id, knowledge_base_id)),
    ])

    service = WorkflowService(workflow_repository=repository)

    workflow_runs, _ = await service.list_workflow_runs(
        tenant_id=workflow_run.tenant_id,
        sort_order="updated-desc",
        limit=10,
        offset=0,
    )

    assert workflow_runs[0].subject_label == "Operator Handbook"
    assert workflow_runs[0].subject_workspace_id == workspace_id
    assert workflow_runs[0].subject_knowledge_base_id == knowledge_base_id
