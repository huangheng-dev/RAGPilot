from temporalio.exceptions import ApplicationError

import pytest

from ragpilot_worker.activities import document_ingestion as document_ingestion_activity


class FakeSessionManager:
    async def __aenter__(self):
        return object()

    async def __aexit__(self, exc_type, exc, tb):
        return False


@pytest.mark.anyio
async def test_ingest_document_marks_missing_context_as_non_retryable(monkeypatch) -> None:
    failed_calls: list[dict[str, str | None]] = []

    class FakeDocumentIngestionService:
        def __init__(self, session) -> None:
            self.session = session

        async def mark_ingestion_running(self, *, workflow_run_id: str, document_id: str) -> str:
            return "step-1"

        async def load_document_ingestion_context(self, *, workflow_run_id: str, document_id: str):
            raise LookupError("Document ingestion context could not be found for the workflow run.")

        async def mark_ingestion_failed(
            self,
            *,
            workflow_run_id: str,
            document_id: str,
            workflow_step_id: str | None,
            error_message: str,
        ) -> None:
            failed_calls.append(
                {
                    "workflow_run_id": workflow_run_id,
                    "document_id": document_id,
                    "workflow_step_id": workflow_step_id,
                    "error_message": error_message,
                }
            )

    monkeypatch.setattr(document_ingestion_activity, "async_session_factory", lambda: FakeSessionManager())
    monkeypatch.setattr(document_ingestion_activity, "DocumentIngestionService", FakeDocumentIngestionService)

    with pytest.raises(ApplicationError, match="Document ingestion context could not be found for the workflow run.") as error:
        await document_ingestion_activity.ingest_document(
            {
                "workflow_run_id": "workflow-1",
                "document_id": "document-1",
            }
        )

    assert error.value.non_retryable is True
    assert failed_calls == [
        {
            "workflow_run_id": "workflow-1",
            "document_id": "document-1",
            "workflow_step_id": "step-1",
            "error_message": "Document ingestion context could not be found for the workflow run.",
        }
    ]
