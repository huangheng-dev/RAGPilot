from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from ragpilot_api.application.documents.data_source_service import DataSourceService
from ragpilot_api.contracts.http.data_source_contracts import DataSourceCreateRequest
from ragpilot_api.infrastructure.database.repositories.data_source_repository import build_data_source_identity


def build_source(**overrides):
    now = datetime.now(timezone.utc)
    values = {
        "id": uuid4(), "tenant_id": uuid4(), "knowledge_base_id": uuid4(), "name": "Handbook",
        "source_type": "web", "source_uri": "https://example.com/handbook", "identity_key": "identity",
        "connection_status": "connected", "sync_status": "completed", "sync_cursor": "hash-v1",
        "last_synced_at": now, "last_sync_error": None, "metadata_json": {}, "deleted_at": None,
        "sync_lease_token": None, "sync_lease_expires_at": None,
        "created_at": now, "updated_at": now,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


@pytest.mark.anyio
async def test_data_source_create_returns_durable_identity_and_sync_state() -> None:
    source = build_source()
    repository = SimpleNamespace(get_or_create=AsyncMock(return_value=source))
    response = await DataSourceService(repository).create(DataSourceCreateRequest(
        tenant_id=source.tenant_id, knowledge_base_id=source.knowledge_base_id, name=source.name,
        source_type="web", source_uri=source.source_uri,
    ))
    assert response.id == source.id
    assert response.sync_status == "completed"
    repository.get_or_create.assert_awaited_once()


def test_data_source_identity_is_stable_and_knowledge_base_scoped() -> None:
    knowledge_base_id = uuid4()
    first = build_data_source_identity(
        knowledge_base_id=knowledge_base_id, source_type="web", source_uri="HTTPS://EXAMPLE.COM/HANDBOOK", name="A",
    )
    second = build_data_source_identity(
        knowledge_base_id=knowledge_base_id, source_type="web", source_uri="https://example.com/handbook", name="B",
    )
    assert first == second


@pytest.mark.anyio
async def test_start_sync_claims_lease_before_starting_temporal_workflow() -> None:
    source = build_source(sync_status="syncing")
    run = SimpleNamespace(
        id=uuid4(), data_source_id=source.id, tenant_id=source.tenant_id, run_status="running",
        cursor_before="hash-v1", cursor_after=None, documents_discovered=0, documents_changed=0,
        documents_unchanged=0, documents_deleted=0, temporal_workflow_id=f"data-source-sync-{uuid4()}",
        heartbeat_at=datetime.now(timezone.utc), error_message=None,
        started_at=datetime.now(timezone.utc), completed_at=None,
    )
    lease_token = uuid4()
    repository = SimpleNamespace(
        claim_sync=AsyncMock(return_value=(source, run, lease_token)),
        fail_workflow_start=AsyncMock(),
    )
    workflow_client = SimpleNamespace(start_data_source_sync_workflow=AsyncMock(return_value=run.temporal_workflow_id))

    response = await DataSourceService(repository).start_sync(
        data_source_id=source.id, tenant_id=source.tenant_id, workflow_client=workflow_client,
    )

    assert response.id == run.id
    assert response.run_status == "running"
    workflow_client.start_data_source_sync_workflow.assert_awaited_once_with(
        temporal_workflow_id=run.temporal_workflow_id,
        data_source_id=str(source.id),
        sync_run_id=str(run.id),
        lease_token=str(lease_token),
    )
    repository.fail_workflow_start.assert_not_awaited()
