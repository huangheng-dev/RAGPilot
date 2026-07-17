from typing import get_type_hints

import pytest
from temporalio.converter import DataConverter

from ragpilot_worker.activities.data_source_sync import (
    fail_data_source_sync,
    prepare_data_source_sync,
)
from ragpilot_worker.activities.document_ingestion import ingest_document
from ragpilot_worker.activities.search_projection import project_document_version_to_elasticsearch
from ragpilot_worker.workflows.data_source_sync import DataSourceSyncWorkflow
from ragpilot_worker.workflows.document_ingestion import DocumentIngestionWorkflow
from ragpilot_worker.workflows.search_projection import SearchProjectionWorkflow


TRACE_CONTEXT = {"traceparent": "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01"}


async def assert_temporal_round_trip(function, payload: dict) -> None:
    payload_type = get_type_hints(function)["payload"]
    converter = DataConverter.default
    encoded = await converter.encode([payload])
    decoded = await converter.decode(encoded, [payload_type])
    assert decoded == [payload]


@pytest.mark.anyio
async def test_document_ingestion_contract_accepts_nested_trace_context() -> None:
    payload = {
        "workflow_run_id": "workflow-run-1",
        "document_id": "document-1",
        "trace_context": TRACE_CONTEXT,
    }
    await assert_temporal_round_trip(DocumentIngestionWorkflow.run, payload)
    await assert_temporal_round_trip(ingest_document, payload)


@pytest.mark.anyio
async def test_search_projection_contract_accepts_nested_trace_context() -> None:
    payload = {
        "projection_event_id": "projection-event-1",
        "trace_context": TRACE_CONTEXT,
    }
    await assert_temporal_round_trip(SearchProjectionWorkflow.run, payload)
    await assert_temporal_round_trip(project_document_version_to_elasticsearch, payload)


@pytest.mark.anyio
async def test_data_source_sync_contract_accepts_nested_trace_context() -> None:
    payload = {
        "data_source_id": "data-source-1",
        "sync_run_id": "sync-run-1",
        "lease_token": "lease-1",
        "trace_context": TRACE_CONTEXT,
    }
    await assert_temporal_round_trip(DataSourceSyncWorkflow.run, payload)
    await assert_temporal_round_trip(prepare_data_source_sync, payload)
    await assert_temporal_round_trip(fail_data_source_sync, {**payload, "error_message": "failed"})
