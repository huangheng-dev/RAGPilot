from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

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
        "operator_notes": None,
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


def build_step_summary(**overrides):
    return {
        "total_step_count": 0,
        "completed_step_count": 0,
        "failed_step_count": 0,
        "active_step_count": 0,
        "pending_step_count": 0,
        "latest_active_step_name": None,
        "latest_active_step_started_at": None,
        "latest_completed_step_name": None,
        "latest_completed_step_completed_at": None,
        "highest_attempt_step_name": None,
        "highest_attempt_count": 0,
        "latest_failed_step_name": None,
        "latest_failed_step_error_message": None,
        **overrides,
    }


def build_child_retry_summary(**overrides):
    return {
        "child_retry_run_count": 0,
        "latest_child_retry_run_id": None,
        "latest_child_retry_status": None,
        "active_child_retry_run_id": None,
        **overrides,
    }


@pytest.mark.anyio
async def test_retry_workflow_run_rejects_deleted_source_document() -> None:
    workflow_run = build_workflow_run()
    repository = SimpleNamespace(
        get_workflow_run=AsyncMock(return_value=workflow_run),
        session=AsyncMock(),
        get_workflow_run_by_id=AsyncMock(return_value=None),
        get_child_retry_summary=AsyncMock(return_value=build_child_retry_summary()),
        get_workflow_step_summary=AsyncMock(return_value=build_step_summary()),
    )
    repository.session.execute = AsyncMock(return_value=SimpleNamespace(first=lambda: (datetime.now(timezone.utc),)))
    repository.session.commit = AsyncMock()
    document_repository = SimpleNamespace(create_reindex_workflow_run=AsyncMock())

    service = WorkflowService(
        workflow_repository=repository,
        document_repository=document_repository,
    )

    with pytest.raises(
        ResourceConflictError,
        match="Retry is unavailable because the source document is no longer active in this knowledge base.",
    ):
        await service.retry_workflow_run(
            workflow_run_id=workflow_run.id,
            tenant_id=workflow_run.tenant_id,
        )

    repository.session.commit.assert_not_awaited()
    document_repository.create_reindex_workflow_run.assert_not_awaited()


@pytest.mark.anyio
async def test_cancel_workflow_run_rejects_completed_runs() -> None:
    workflow_run = build_workflow_run(workflow_status="completed")
    repository = SimpleNamespace(
        get_workflow_run=AsyncMock(return_value=workflow_run),
        session=AsyncMock(),
        get_workflow_run_by_id=AsyncMock(return_value=None),
        get_child_retry_summary=AsyncMock(return_value=build_child_retry_summary()),
        get_workflow_step_summary=AsyncMock(return_value=build_step_summary()),
    )

    service = WorkflowService(workflow_repository=repository)

    with pytest.raises(
        ResourceConflictError,
        match="Only pending, queued, or running workflow runs can be cancelled.",
    ):
        await service.cancel_workflow_run(
            workflow_run_id=workflow_run.id,
            tenant_id=workflow_run.tenant_id,
        )


@pytest.mark.anyio
async def test_cancel_workflow_run_cancels_pending_document_without_temporal_runtime() -> None:
    workflow_run = build_workflow_run(
        workflow_status="pending",
        temporal_workflow_id=None,
        input_json={"document_version_id": str(uuid4())},
        completed_at=None,
    )
    repository = SimpleNamespace(
        get_workflow_run=AsyncMock(return_value=workflow_run),
        mark_workflow_run_cancelled=AsyncMock(return_value=build_workflow_run(
            id=workflow_run.id,
            tenant_id=workflow_run.tenant_id,
            workflow_status="cancelled",
            temporal_workflow_id=None,
            input_json=workflow_run.input_json,
            error_message="Cancelled by operator.",
        )),
        session=AsyncMock(),
        get_workflow_run_by_id=AsyncMock(return_value=None),
        get_child_retry_summary=AsyncMock(return_value=build_child_retry_summary()),
        get_workflow_step_summary=AsyncMock(return_value=build_step_summary()),
    )
    repository.session.execute = AsyncMock(side_effect=[
        SimpleNamespace(),
        SimpleNamespace(),
        SimpleNamespace(first=lambda: ("Operator Handbook", uuid4(), uuid4())),
    ])
    temporal_client = SimpleNamespace(cancel_workflow=AsyncMock())
    repository.session.commit = AsyncMock()

    service = WorkflowService(
        workflow_repository=repository,
        temporal_workflow_client=temporal_client,
    )

    response = await service.cancel_workflow_run(
        workflow_run_id=workflow_run.id,
        tenant_id=workflow_run.tenant_id,
    )

    temporal_client.cancel_workflow.assert_not_awaited()
    assert repository.session.execute.await_count == 3
    repository.mark_workflow_run_cancelled.assert_awaited_once()
    assert response.workflow_status == "cancelled"
    assert response.recommended_next_view == "documents"


@pytest.mark.anyio
async def test_cancel_workflow_run_terminates_active_temporal_runtime() -> None:
    workflow_run = build_workflow_run(
        workflow_status="running",
        temporal_workflow_id="document-ingestion-example",
        input_json={"document_version_id": str(uuid4())},
        completed_at=None,
    )
    repository = SimpleNamespace(
        get_workflow_run=AsyncMock(return_value=workflow_run),
        mark_workflow_run_cancelled=AsyncMock(return_value=build_workflow_run(
            id=workflow_run.id,
            tenant_id=workflow_run.tenant_id,
            workflow_status="cancelled",
            temporal_workflow_id=workflow_run.temporal_workflow_id,
            input_json=workflow_run.input_json,
            error_message="Cancelled by operator.",
        )),
        session=AsyncMock(),
        get_workflow_run_by_id=AsyncMock(return_value=None),
        get_child_retry_summary=AsyncMock(return_value=build_child_retry_summary()),
        get_workflow_step_summary=AsyncMock(return_value=build_step_summary()),
    )
    repository.session.execute = AsyncMock(side_effect=[
        SimpleNamespace(),
        SimpleNamespace(),
        SimpleNamespace(first=lambda: ("Operator Handbook", uuid4(), uuid4())),
    ])
    temporal_client = SimpleNamespace(cancel_workflow=AsyncMock())
    repository.session.commit = AsyncMock()

    service = WorkflowService(
        workflow_repository=repository,
        temporal_workflow_client=temporal_client,
    )

    response = await service.cancel_workflow_run(
        workflow_run_id=workflow_run.id,
        tenant_id=workflow_run.tenant_id,
    )

    temporal_client.cancel_workflow.assert_awaited_once_with(
        temporal_workflow_id="document-ingestion-example",
        reason="Cancelled by operator.",
    )
    repository.mark_workflow_run_cancelled.assert_awaited_once()
    assert response.workflow_status == "cancelled"


@pytest.mark.anyio
async def test_resolve_workflow_retry_state_marks_active_failed_document_runs_as_retryable() -> None:
    workflow_run = build_workflow_run()
    repository = SimpleNamespace(
        session=AsyncMock(),
        get_workflow_run_by_id=AsyncMock(return_value=None),
        get_child_retry_summary=AsyncMock(return_value=build_child_retry_summary()),
        get_workflow_step_summary=AsyncMock(return_value=build_step_summary()),
    )
    repository.session.execute = AsyncMock(return_value=SimpleNamespace(first=lambda: (None,)))

    retry_state = await resolve_workflow_retry_state(repository, workflow_run)

    assert retry_state == {
        "is_retry_available": True,
        "retry_unavailable_reason": None,
    }


@pytest.mark.anyio
async def test_resolve_workflow_retry_state_reports_deleted_source_document() -> None:
    workflow_run = build_workflow_run()
    repository = SimpleNamespace(
        session=AsyncMock(),
        get_workflow_run_by_id=AsyncMock(return_value=None),
        get_child_retry_summary=AsyncMock(return_value=build_child_retry_summary()),
        get_workflow_step_summary=AsyncMock(return_value=build_step_summary()),
    )
    repository.session.execute = AsyncMock(return_value=SimpleNamespace(first=lambda: (datetime.now(timezone.utc),)))

    retry_state = await resolve_workflow_retry_state(repository, workflow_run)

    assert retry_state == {
        "is_retry_available": False,
        "retry_unavailable_reason": "Retry is unavailable because the source document is no longer active in this knowledge base.",
    }


@pytest.mark.anyio
async def test_resolve_workflow_retry_state_blocks_when_retry_depth_limit_is_reached() -> None:
    retry_parent_id = str(uuid4())
    grandparent_run = build_workflow_run(input_json={})
    root_parent_run = build_workflow_run(
        input_json={"retry_of_workflow_run_id": str(grandparent_run.id)},
    )
    workflow_run = build_workflow_run(
        input_json={"retry_of_workflow_run_id": retry_parent_id},
    )
    parent_run = build_workflow_run(
        id=UUID(retry_parent_id),
        input_json={"retry_of_workflow_run_id": str(root_parent_run.id)},
    )
    repository = SimpleNamespace(
        session=AsyncMock(),
        get_workflow_run_by_id=AsyncMock(side_effect=[parent_run, root_parent_run, grandparent_run]),
        get_child_retry_summary=AsyncMock(return_value=build_child_retry_summary()),
        get_workflow_step_summary=AsyncMock(return_value=build_step_summary()),
    )
    repository.session.execute = AsyncMock(return_value=SimpleNamespace(first=lambda: (None,)))

    retry_state = await resolve_workflow_retry_state(repository, workflow_run)

    assert retry_state == {
        "is_retry_available": False,
        "retry_unavailable_reason": "Retry is unavailable because this workflow has already reached the retry depth limit.",
    }


@pytest.mark.anyio
async def test_resolve_workflow_retry_state_blocks_when_child_retry_is_active() -> None:
    workflow_run = build_workflow_run()
    active_child_retry_run_id = uuid4()
    repository = SimpleNamespace(
        session=AsyncMock(),
        get_workflow_run_by_id=AsyncMock(return_value=None),
        get_child_retry_summary=AsyncMock(
            return_value=build_child_retry_summary(
                child_retry_run_count=1,
                latest_child_retry_run_id=active_child_retry_run_id,
                latest_child_retry_status="running",
                active_child_retry_run_id=active_child_retry_run_id,
            )
        ),
        get_workflow_step_summary=AsyncMock(return_value=build_step_summary()),
    )
    repository.session.execute = AsyncMock(return_value=SimpleNamespace(first=lambda: (None,)))

    retry_state = await resolve_workflow_retry_state(repository, workflow_run)

    assert retry_state == {
        "is_retry_available": False,
        "retry_unavailable_reason": "Retry is unavailable because another retry run is already active for this workflow.",
    }


@pytest.mark.anyio
async def test_list_workflow_runs_includes_retry_available_recovery_guidance() -> None:
    workflow_run = build_workflow_run()
    workspace_id = uuid4()
    knowledge_base_id = uuid4()
    repository = SimpleNamespace(
        list_workflow_runs=AsyncMock(return_value=([workflow_run], 1)),
        session=AsyncMock(),
        get_workflow_run_by_id=AsyncMock(return_value=None),
        get_child_retry_summary=AsyncMock(return_value=build_child_retry_summary()),
        get_workflow_step_summary=AsyncMock(
            return_value=build_step_summary(
                failed_step_count=1,
                total_step_count=2,
                latest_failed_step_name="embed_document",
                latest_failed_step_error_message="Embedding pipeline returned an invalid vector payload",
                highest_attempt_step_name="embed_document",
                highest_attempt_count=2,
            )
        ),
    )
    repository.session.execute = AsyncMock(side_effect=[
        SimpleNamespace(first=lambda: ("Operator Handbook", workspace_id, knowledge_base_id)),
        SimpleNamespace(first=lambda: (None,)),
    ])

    service = WorkflowService(workflow_repository=repository)

    workflow_runs, _ = await service.list_workflow_runs(
        tenant_id=workflow_run.tenant_id,
        sort_order="updated-desc",
        limit=10,
        offset=0,
    )

    assert workflow_runs[0].recovery_stage == "review_workflow"
    assert workflow_runs[0].recommended_next_view == "workflows"
    assert workflow_runs[0].recommended_primary_action == "open_workflows"
    assert "embed_document" in (workflow_runs[0].follow_up_reason or "")
    assert workflow_runs[0].failure_category == "embedding_failure"
    assert workflow_runs[0].failure_recommended_action == "review_runtime"
    assert workflow_runs[0].failure_recommended_view == "workflows"
    assert workflow_runs[0].failure_recommended_primary_action == "open_workflows"
    assert workflow_runs[0].failure_focus_step_name == "embed_document"
    assert [action.action_key for action in workflow_runs[0].recovery_actions] == [
        "review_runtime",
        "retry_when_ready",
    ]
    assert workflow_runs[0].recovery_actions[0].is_primary is True
    assert workflow_runs[0].recovery_actions[1].target_primary_action == "retry_workflow"


@pytest.mark.anyio
async def test_list_workflow_runs_includes_deleted_document_recovery_guidance() -> None:
    workflow_run = build_workflow_run()
    repository = SimpleNamespace(
        list_workflow_runs=AsyncMock(return_value=([workflow_run], 1)),
        session=AsyncMock(),
        get_workflow_run_by_id=AsyncMock(return_value=None),
        get_child_retry_summary=AsyncMock(return_value=build_child_retry_summary(child_retry_run_count=1, latest_child_retry_run_id=uuid4())),
        get_workflow_step_summary=AsyncMock(return_value=build_step_summary(failed_step_count=1, total_step_count=3)),
    )
    repository.session.execute = AsyncMock(side_effect=[
        SimpleNamespace(first=lambda: ("Operator Handbook", uuid4(), uuid4())),
        SimpleNamespace(first=lambda: (datetime.now(timezone.utc),)),
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
    assert workflow_runs[0].failure_category == "source_deleted"
    assert workflow_runs[0].failure_recommended_action == "review_document_source"
    assert workflow_runs[0].failure_recommended_view == "documents"
    assert workflow_runs[0].failure_recommended_primary_action == "open_document"
    assert [action.action_key for action in workflow_runs[0].recovery_actions] == [
        "review_document_source",
        "inspect_workflow",
    ]
    assert workflow_runs[0].recovery_actions[0].target_primary_action == "open_document"
    assert workflow_runs[0].recovery_actions[1].target_primary_action == "open_workflows"


@pytest.mark.anyio
async def test_list_workflow_runs_includes_disabled_runtime_retry_recovery_action() -> None:
    workflow_run = build_workflow_run()
    active_child_retry_run_id = uuid4()
    repository = SimpleNamespace(
        list_workflow_runs=AsyncMock(return_value=([workflow_run], 1)),
        session=AsyncMock(),
        get_workflow_run_by_id=AsyncMock(return_value=None),
        get_child_retry_summary=AsyncMock(
            return_value=build_child_retry_summary(
                child_retry_run_count=1,
                latest_child_retry_run_id=active_child_retry_run_id,
                latest_child_retry_status="running",
                active_child_retry_run_id=active_child_retry_run_id,
            )
        ),
        get_workflow_step_summary=AsyncMock(
            return_value=build_step_summary(
                failed_step_count=1,
                total_step_count=3,
                latest_failed_step_name="run_temporal_workflow",
                latest_failed_step_error_message="Temporal activity timed out after 300 seconds",
            )
        ),
    )
    repository.session.execute = AsyncMock(side_effect=[
        SimpleNamespace(first=lambda: ("Operator Handbook", uuid4(), uuid4())),
    ])

    service = WorkflowService(workflow_repository=repository)

    workflow_runs, _ = await service.list_workflow_runs(
        tenant_id=workflow_run.tenant_id,
        sort_order="updated-desc",
        limit=10,
        offset=0,
    )

    assert workflow_runs[0].failure_category == "runtime_timeout"
    assert workflow_runs[0].recovery_actions[0].action_key == "retry_when_ready"
    assert workflow_runs[0].recovery_actions[0].is_primary is True
    assert workflow_runs[0].recovery_actions[0].is_enabled is False
    assert workflow_runs[0].recovery_actions[0].target_primary_action == "open_workflows"
    assert (
        workflow_runs[0].recovery_actions[0].disabled_reason
        == "Retry is unavailable because another retry run is already active for this workflow."
    )
    assert workflow_runs[0].recovery_actions[1].action_key == "review_runtime"


@pytest.mark.anyio
async def test_list_workflow_runs_includes_completed_recovery_guidance() -> None:
    workflow_run = build_workflow_run(workflow_status="completed")
    repository = SimpleNamespace(
        list_workflow_runs=AsyncMock(return_value=([workflow_run], 1)),
        session=AsyncMock(),
        get_workflow_run_by_id=AsyncMock(return_value=None),
        get_child_retry_summary=AsyncMock(return_value=build_child_retry_summary()),
        get_workflow_step_summary=AsyncMock(return_value=build_step_summary(completed_step_count=3, total_step_count=3)),
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
async def test_list_workflow_runs_includes_active_step_follow_up_reason() -> None:
    workflow_run = build_workflow_run(workflow_status="running")
    repository = SimpleNamespace(
        list_workflow_runs=AsyncMock(return_value=([workflow_run], 1)),
        session=AsyncMock(),
        get_workflow_run_by_id=AsyncMock(return_value=None),
        get_child_retry_summary=AsyncMock(return_value=build_child_retry_summary()),
        get_workflow_step_summary=AsyncMock(
            return_value=build_step_summary(
                active_step_count=1,
                latest_active_step_name="index_document",
                latest_active_step_started_at=datetime.now(timezone.utc),
                latest_completed_step_name="embed_document",
                latest_completed_step_completed_at=datetime.now(timezone.utc),
            )
        ),
    )
    repository.session.execute = AsyncMock(return_value=SimpleNamespace(first=lambda: ("Operator Handbook", uuid4(), uuid4())))

    service = WorkflowService(workflow_repository=repository)

    workflow_runs, _ = await service.list_workflow_runs(
        tenant_id=workflow_run.tenant_id,
        sort_order="updated-desc",
        limit=10,
        offset=0,
    )

    assert workflow_runs[0].recovery_stage == "active_monitoring"
    assert "index_document" in (workflow_runs[0].follow_up_reason or "")
    assert workflow_runs[0].latest_active_step_name == "index_document"
    assert workflow_runs[0].latest_completed_step_name == "embed_document"
    assert workflow_runs[0].failure_category is None


@pytest.mark.anyio
async def test_list_workflow_runs_classifies_parser_failures() -> None:
    workflow_run = build_workflow_run(error_message="Unsupported content type for parser")
    repository = SimpleNamespace(
        list_workflow_runs=AsyncMock(return_value=([workflow_run], 1)),
        session=AsyncMock(),
        get_workflow_run_by_id=AsyncMock(return_value=None),
        get_child_retry_summary=AsyncMock(return_value=build_child_retry_summary()),
        get_workflow_step_summary=AsyncMock(
            return_value=build_step_summary(
                failed_step_count=1,
                total_step_count=1,
                latest_failed_step_name="parse_document",
                latest_failed_step_error_message="Unsupported content type for parser",
            )
        ),
    )
    repository.session.execute = AsyncMock(side_effect=[
        SimpleNamespace(first=lambda: ("Operator Handbook", uuid4(), uuid4())),
        SimpleNamespace(first=lambda: (None,)),
    ])

    service = WorkflowService(workflow_repository=repository)

    workflow_runs, _ = await service.list_workflow_runs(
        tenant_id=workflow_run.tenant_id,
        sort_order="updated-desc",
        limit=10,
        offset=0,
    )

    assert workflow_runs[0].failure_category == "parser_failure"
    assert workflow_runs[0].failure_recommended_action == "review_parser_path"
    assert workflow_runs[0].failure_recommended_view == "documents"
    assert workflow_runs[0].failure_recommended_primary_action == "open_document"
    assert workflow_runs[0].recommended_next_view == "documents"
    assert workflow_runs[0].recommended_primary_action == "open_document"


@pytest.mark.anyio
async def test_list_workflow_runs_classifies_runtime_timeout_for_retry_path() -> None:
    workflow_run = build_workflow_run(error_message="Embedding provider timeout")
    repository = SimpleNamespace(
        list_workflow_runs=AsyncMock(return_value=([workflow_run], 1)),
        session=AsyncMock(),
        get_workflow_run_by_id=AsyncMock(return_value=None),
        get_child_retry_summary=AsyncMock(return_value=build_child_retry_summary()),
        get_workflow_step_summary=AsyncMock(
            return_value=build_step_summary(
                failed_step_count=1,
                total_step_count=1,
                latest_failed_step_name="embed_document",
                latest_failed_step_error_message="Embedding provider timeout",
            )
        ),
    )
    repository.session.execute = AsyncMock(side_effect=[
        SimpleNamespace(first=lambda: ("Operator Handbook", uuid4(), uuid4())),
        SimpleNamespace(first=lambda: (None,)),
    ])

    service = WorkflowService(workflow_repository=repository)

    workflow_runs, _ = await service.list_workflow_runs(
        tenant_id=workflow_run.tenant_id,
        sort_order="updated-desc",
        limit=10,
        offset=0,
    )

    assert workflow_runs[0].failure_category == "runtime_timeout"
    assert workflow_runs[0].failure_recommended_action == "retry_when_ready"
    assert workflow_runs[0].failure_recommended_view == "workflows"
    assert workflow_runs[0].failure_recommended_primary_action == "retry_workflow"


@pytest.mark.anyio
async def test_list_workflow_runs_forwards_subject_filter_to_repository() -> None:
    tenant_id = uuid4()
    subject_id = uuid4()
    workflow_run = build_workflow_run(tenant_id=tenant_id, subject_id=subject_id)
    repository = SimpleNamespace(
        list_workflow_runs=AsyncMock(return_value=([workflow_run], 1)),
        session=AsyncMock(),
        get_workflow_run_by_id=AsyncMock(return_value=None),
        get_child_retry_summary=AsyncMock(return_value=build_child_retry_summary()),
        get_workflow_step_summary=AsyncMock(return_value=build_step_summary()),
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
        get_workflow_run_by_id=AsyncMock(return_value=None),
        get_child_retry_summary=AsyncMock(return_value=build_child_retry_summary()),
        get_workflow_step_summary=AsyncMock(return_value=build_step_summary()),
    )
    repository.session.execute = AsyncMock(side_effect=[
        SimpleNamespace(first=lambda: ("Operator Handbook", workspace_id, knowledge_base_id)),
        SimpleNamespace(first=lambda: (None,)),
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


@pytest.mark.anyio
async def test_update_workflow_run_operator_notes_trims_and_returns_detail() -> None:
    workflow_run = build_workflow_run(operator_notes=None)
    updated_workflow_run = build_workflow_run(
        id=workflow_run.id,
        tenant_id=workflow_run.tenant_id,
        operator_notes="Need to recheck parser output.",
    )
    repository = SimpleNamespace(
        get_workflow_run=AsyncMock(return_value=workflow_run),
        update_workflow_run_operator_notes=AsyncMock(return_value=updated_workflow_run),
        list_workflow_steps=AsyncMock(return_value=[]),
        session=AsyncMock(),
        get_workflow_run_by_id=AsyncMock(return_value=None),
        get_child_retry_summary=AsyncMock(return_value=build_child_retry_summary()),
        get_workflow_step_summary=AsyncMock(return_value=build_step_summary()),
    )
    repository.session.execute = AsyncMock(return_value=SimpleNamespace(first=lambda: ("Operator Handbook", uuid4(), uuid4())))

    workflow_event_repository = SimpleNamespace(
        list_workflow_run_events=AsyncMock(return_value=[]),
        create_workflow_run_event=AsyncMock(),
        get_workflow_run_event_summary=AsyncMock(return_value={"recovery_event_count": 1, "latest_recovery_event_at": datetime.now(timezone.utc)}),
    )

    service = WorkflowService(
        workflow_repository=repository,
        workflow_event_repository=workflow_event_repository,
    )

    detail = await service.update_workflow_run_operator_notes(
        workflow_run_id=workflow_run.id,
        tenant_id=workflow_run.tenant_id,
        operator_notes="  Need to recheck parser output.  ",
        actor_user_id=uuid4(),
        actor_role="operator",
    )

    repository.update_workflow_run_operator_notes.assert_awaited_once_with(
        workflow_run=workflow_run,
        operator_notes="Need to recheck parser output.",
    )
    workflow_event_repository.create_workflow_run_event.assert_awaited_once()
    assert detail.operator_notes == "Need to recheck parser output."
    assert detail.events == []


@pytest.mark.anyio
async def test_update_workflow_run_operator_notes_clears_blank_input() -> None:
    workflow_run = build_workflow_run(operator_notes="Old note")
    updated_workflow_run = build_workflow_run(
        id=workflow_run.id,
        tenant_id=workflow_run.tenant_id,
        operator_notes=None,
    )
    repository = SimpleNamespace(
        get_workflow_run=AsyncMock(return_value=workflow_run),
        update_workflow_run_operator_notes=AsyncMock(return_value=updated_workflow_run),
        list_workflow_steps=AsyncMock(return_value=[]),
        session=AsyncMock(),
        get_workflow_run_by_id=AsyncMock(return_value=None),
        get_child_retry_summary=AsyncMock(return_value=build_child_retry_summary()),
        get_workflow_step_summary=AsyncMock(return_value=build_step_summary()),
    )
    repository.session.execute = AsyncMock(return_value=SimpleNamespace(first=lambda: ("Operator Handbook", uuid4(), uuid4())))

    workflow_event_repository = SimpleNamespace(
        list_workflow_run_events=AsyncMock(return_value=[]),
        create_workflow_run_event=AsyncMock(),
        get_workflow_run_event_summary=AsyncMock(return_value={"recovery_event_count": 1, "latest_recovery_event_at": datetime.now(timezone.utc)}),
    )

    service = WorkflowService(
        workflow_repository=repository,
        workflow_event_repository=workflow_event_repository,
    )

    detail = await service.update_workflow_run_operator_notes(
        workflow_run_id=workflow_run.id,
        tenant_id=workflow_run.tenant_id,
        operator_notes="   ",
        actor_user_id=uuid4(),
        actor_role="operator",
    )

    repository.update_workflow_run_operator_notes.assert_awaited_once_with(
        workflow_run=workflow_run,
        operator_notes=None,
    )
    workflow_event_repository.create_workflow_run_event.assert_awaited_once()
    assert detail.operator_notes is None
    assert detail.events == []


@pytest.mark.anyio
async def test_get_workflow_run_detail_includes_recent_workflow_events() -> None:
    workflow_run = build_workflow_run()
    workflow_event = SimpleNamespace(
        id=uuid4(),
        tenant_id=workflow_run.tenant_id,
        workflow_run_id=workflow_run.id,
        actor_user_id=uuid4(),
        actor_role="operator",
        action_type="cancel_requested",
        detail_json={"reason": "Cancelled by operator."},
        created_at=datetime.now(timezone.utc),
    )
    repository = SimpleNamespace(
        get_workflow_run=AsyncMock(return_value=workflow_run),
        list_workflow_steps=AsyncMock(return_value=[]),
        session=AsyncMock(),
        get_workflow_run_by_id=AsyncMock(return_value=None),
        get_child_retry_summary=AsyncMock(return_value=build_child_retry_summary(child_retry_run_count=1, latest_child_retry_run_id=uuid4())),
        get_workflow_step_summary=AsyncMock(return_value=build_step_summary(failed_step_count=1, total_step_count=4)),
    )
    repository.session.execute = AsyncMock(return_value=SimpleNamespace(first=lambda: ("Operator Handbook", uuid4(), uuid4())))
    workflow_event_repository = SimpleNamespace(
        list_workflow_run_events=AsyncMock(return_value=[workflow_event]),
        get_workflow_run_event_summary=AsyncMock(return_value={"recovery_event_count": 3, "latest_recovery_event_at": workflow_event.created_at}),
    )

    service = WorkflowService(
        workflow_repository=repository,
        workflow_event_repository=workflow_event_repository,
    )

    detail = await service.get_workflow_run_detail(
        workflow_run_id=workflow_run.id,
        tenant_id=workflow_run.tenant_id,
    )

    assert detail is not None
    assert len(detail.events) == 1
    assert detail.events[0].action_type == "cancel_requested"
    assert detail.events[0].detail["reason"] == "Cancelled by operator."
    assert detail.recovery_event_count == 3
    assert detail.child_retry_run_count == 1
    assert detail.latest_active_step_name is None


@pytest.mark.anyio
async def test_list_workflow_run_steps_forwards_filters() -> None:
    workflow_run = build_workflow_run()
    workflow_step = SimpleNamespace(
        id=uuid4(),
        tenant_id=workflow_run.tenant_id,
        workflow_run_id=workflow_run.id,
        step_name="embed_document",
        step_status="failed",
        attempt_count=2,
        error_message="Embedding provider timeout",
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    repository = SimpleNamespace(
        get_workflow_run=AsyncMock(return_value=workflow_run),
        list_workflow_steps=AsyncMock(return_value=[workflow_step]),
        get_workflow_run_by_id=AsyncMock(return_value=None),
        get_child_retry_summary=AsyncMock(return_value=build_child_retry_summary()),
        get_workflow_step_summary=AsyncMock(
            return_value=build_step_summary(
                failed_step_count=1,
                total_step_count=1,
                latest_failed_step_name="embed_document",
                latest_failed_step_error_message="Embedding provider timeout",
                highest_attempt_step_name="embed_document",
                highest_attempt_count=2,
            )
        ),
        session=AsyncMock(),
    )
    repository.session.execute = AsyncMock(return_value=SimpleNamespace(first=lambda: (None,)))

    service = WorkflowService(workflow_repository=repository)

    steps = await service.list_workflow_run_steps(
        workflow_run_id=workflow_run.id,
        tenant_id=workflow_run.tenant_id,
        status_filter="failed",
        min_attempt_count=2,
        limit=10,
    )

    repository.list_workflow_steps.assert_awaited_once_with(
        workflow_run_id=workflow_run.id,
        status_filter="failed",
        min_attempt_count=2,
        limit=10,
    )
    assert len(steps) == 1
    assert steps[0].step_name == "embed_document"
    assert steps[0].failure_category == "runtime_timeout"
    assert steps[0].failure_recommended_action == "retry_when_ready"
    assert steps[0].is_failure_focus is True
    assert [action.action_key for action in steps[0].recovery_actions] == [
        "retry_when_ready",
        "review_runtime",
    ]


@pytest.mark.anyio
async def test_retry_workflow_run_records_blocked_event_when_active_retry_exists() -> None:
    workflow_run = build_workflow_run()
    active_child_retry_run_id = uuid4()
    repository = SimpleNamespace(
        get_workflow_run=AsyncMock(return_value=workflow_run),
        session=AsyncMock(),
        get_workflow_run_by_id=AsyncMock(return_value=None),
        get_child_retry_summary=AsyncMock(
            return_value=build_child_retry_summary(
                child_retry_run_count=1,
                latest_child_retry_run_id=active_child_retry_run_id,
                latest_child_retry_status="queued",
                active_child_retry_run_id=active_child_retry_run_id,
            )
        ),
        get_workflow_step_summary=AsyncMock(return_value=build_step_summary()),
    )
    repository.session.execute = AsyncMock(return_value=SimpleNamespace(first=lambda: (None,)))
    workflow_event_repository = SimpleNamespace(
        create_workflow_run_event=AsyncMock(),
        get_workflow_run_event_summary=AsyncMock(return_value={"recovery_event_count": 0, "latest_recovery_event_at": None}),
    )

    service = WorkflowService(
        workflow_repository=repository,
        document_repository=SimpleNamespace(create_reindex_workflow_run=AsyncMock()),
        workflow_event_repository=workflow_event_repository,
    )

    with pytest.raises(
        ResourceConflictError,
        match="Retry is unavailable because another retry run is already active for this workflow.",
    ):
        await service.retry_workflow_run(
            workflow_run_id=workflow_run.id,
            tenant_id=workflow_run.tenant_id,
            actor_user_id=uuid4(),
            actor_role="operator",
        )

    workflow_event_repository.create_workflow_run_event.assert_awaited_once()
    recorded_detail = workflow_event_repository.create_workflow_run_event.await_args.kwargs["detail_json"]
    assert recorded_detail["reason"] == "Retry is unavailable because another retry run is already active for this workflow."
    assert recorded_detail["active_child_retry_run_id"] == str(active_child_retry_run_id)
