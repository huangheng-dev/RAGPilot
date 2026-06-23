from unittest.mock import AsyncMock, Mock

import pytest
from sqlalchemy.exc import IntegrityError

from ragpilot_worker.application.document_ingestion_service import (
    DOCUMENT_VERSION_REWRITE_CONFLICT_MESSAGE,
    DocumentIngestionService,
    DocumentVersionRewriteConflictError,
)
from ragpilot_worker.workflows.document_ingestion import (
    DocumentIngestionWorkflow,
    LegacyDocumentIngestionWorkflow,
)


def build_mapping_result(payload: dict[str, int]) -> Mock:
    result = Mock()
    mappings = Mock()
    mappings.one.return_value = payload
    result.mappings.return_value = mappings
    return result


@pytest.mark.anyio
async def test_replace_document_chunks_rejects_cited_existing_version() -> None:
    session = AsyncMock()
    session.execute.side_effect = [
        build_mapping_result({"chunk_count": 2}),
        Mock(),
        build_mapping_result({"citation_count": 1}),
    ]
    service = DocumentIngestionService(session)

    with pytest.raises(DocumentVersionRewriteConflictError, match=DOCUMENT_VERSION_REWRITE_CONFLICT_MESSAGE):
        await service.replace_document_chunks(
            tenant_id="tenant-1",
            document_version_id="version-1",
            chunks=[
                {
                    "chunk_index": 0,
                    "content": "example content",
                    "token_count": 2,
                    "metadata_json": {"start_char": 0, "end_char": 15},
                }
            ],
        )

    assert session.commit.await_count == 0


@pytest.mark.anyio
async def test_replace_document_chunks_locks_existing_chunks_before_citation_check() -> None:
    session = AsyncMock()
    session.execute.side_effect = [
        build_mapping_result({"chunk_count": 2}),
        Mock(),
        build_mapping_result({"citation_count": 0}),
        Mock(),
        Mock(),
        build_mapping_result({"id": "chunk-1", "chunk_index": 0, "content": "example content"}),
    ]
    service = DocumentIngestionService(session)

    chunks = await service.replace_document_chunks(
        tenant_id="tenant-1",
        document_version_id="version-1",
        chunks=[
            {
                "chunk_index": 0,
                "content": "example content",
                "token_count": 2,
                "metadata_json": {"start_char": 0, "end_char": 15},
            }
        ],
    )

    assert chunks == [{"id": "chunk-1", "chunk_index": 0, "content": "example content"}]
    executed_sql = str(session.execute.await_args_list[1].args[0])
    assert "FOR UPDATE" in executed_sql
    assert session.commit.await_count == 1


@pytest.mark.anyio
async def test_replace_document_chunks_translates_fk_violation_into_rewrite_conflict() -> None:
    session = AsyncMock()
    session.execute.side_effect = [
        build_mapping_result({"chunk_count": 2}),
        Mock(),
        build_mapping_result({"citation_count": 0}),
        Mock(),
        IntegrityError(
            statement="DELETE FROM document_chunks WHERE document_version_id = :document_version_id",
            params={"document_version_id": "version-1"},
            orig=Exception(
                'update or delete on table "document_chunks" violates foreign key constraint '
                '"fk_message_citations_document_chunk_id_document_chunks" on table "message_citations"'
            ),
        ),
    ]
    service = DocumentIngestionService(session)

    with pytest.raises(DocumentVersionRewriteConflictError, match=DOCUMENT_VERSION_REWRITE_CONFLICT_MESSAGE):
        await service.replace_document_chunks(
            tenant_id="tenant-1",
            document_version_id="version-1",
            chunks=[
                {
                    "chunk_index": 0,
                    "content": "example content",
                    "token_count": 2,
                    "metadata_json": {"start_char": 0, "end_char": 15},
                }
            ],
        )

    assert session.rollback.await_count == 1
    assert session.commit.await_count == 0


def test_document_ingestion_workflow_registration_keeps_legacy_temporal_name() -> None:
    assert DocumentIngestionWorkflow.__temporal_workflow_definition.name == "DocumentIngestionWorkflow"
    assert LegacyDocumentIngestionWorkflow.__temporal_workflow_definition.name == "DocumentIngestionWorkflow.run"


@pytest.mark.anyio
async def test_load_document_ingestion_context_raises_lookup_error_when_workflow_context_is_missing() -> None:
    session = AsyncMock()
    result = Mock()
    mappings = Mock()
    mappings.one_or_none.return_value = None
    result.mappings.return_value = mappings
    session.execute.return_value = result

    service = DocumentIngestionService(session)

    with pytest.raises(
        LookupError,
        match="Document ingestion context could not be found for the workflow run.",
    ):
        await service.load_document_ingestion_context(
            workflow_run_id="workflow-1",
            document_id="document-1",
        )
