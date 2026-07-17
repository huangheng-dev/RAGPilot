from typing import Any

from temporalio import activity
from temporalio.exceptions import ApplicationError

from ragpilot_worker.application.document_ingestion_service import DocumentIngestionService
from ragpilot_worker.config import get_settings
from ragpilot_worker.domain.chunking import build_text_chunks, normalize_text
from ragpilot_worker.infrastructure.database import async_session_factory
from ragpilot_worker.infrastructure.embeddings import build_embedding_provider
from ragpilot_worker.infrastructure.object_storage import DocumentObjectStorage
from ragpilot_worker.infrastructure.observability import traced_activity
from opentelemetry import trace


@activity.defn(name="ingest_document")
@traced_activity("worker.document_ingestion")
async def ingest_document(payload: dict[str, Any]) -> dict[str, str]:
    workflow_run_id = payload["workflow_run_id"]
    document_id = payload["document_id"]
    settings = get_settings()
    embedding_provider = build_embedding_provider(settings)
    activity.logger.info(
        "Starting document ingestion for workflow_run_id=%s document_id=%s",
        workflow_run_id,
        document_id,
    )

    workflow_step_id: str | None = None
    try:
        async with async_session_factory() as session:
            service = DocumentIngestionService(session)
            workflow_step_id = await service.mark_ingestion_running(
                workflow_run_id=workflow_run_id,
                document_id=document_id,
            )

        async with async_session_factory() as session:
            service = DocumentIngestionService(session)
            context = await service.load_document_ingestion_context(
                workflow_run_id=workflow_run_id,
                document_id=document_id,
            )

        storage = DocumentObjectStorage(settings)
        content = storage.read_document_object(
            storage_bucket=context["storage_bucket"],
            storage_key=context["storage_key"],
        )
        parsed_document = normalize_text(
            content,
            content_type=context["content_type"],
            file_name=context["file_name"],
        )
        chunks = build_text_chunks(
            parsed_document.text,
            chunk_size=settings.ingestion_chunk_size,
            chunk_overlap=settings.ingestion_chunk_overlap,
        )
        if not chunks:
            raise ValueError("Document ingestion produced no chunks.")
        trace.get_current_span().set_attribute("ragpilot.ingestion.chunk_count", len(chunks))

        async with async_session_factory() as session:
            service = DocumentIngestionService(session)
            inserted_chunks = await service.replace_document_chunks(
                tenant_id=str(context["input_json"]["tenant_id"]) if "tenant_id" in context["input_json"] else payload["tenant_id"],
                document_version_id=str(context["document_version_id"]),
                chunks=[
                    {
                        "chunk_index": chunk.chunk_index,
                        "content": chunk.content,
                        "token_count": chunk.token_count,
                        "metadata_json": dict(chunk.metadata_json),
                    }
                    for chunk in chunks
                ],
            )

        embeddings = await embedding_provider.embed_texts([chunk["content"] for chunk in inserted_chunks])
        trace.get_current_span().set_attribute("ragpilot.embedding.vector_count", len(embeddings))
        if len(embeddings) != len(inserted_chunks):
            raise ValueError("Embedding generation did not return one vector per chunk.")

        async with async_session_factory() as session:
            service = DocumentIngestionService(session)
            await service.replace_document_chunk_embeddings(
                tenant_id=str(context["input_json"]["tenant_id"]) if "tenant_id" in context["input_json"] else payload["tenant_id"],
                embedding_model=embedding_provider.model_name,
                embedding_dimension=embedding_provider.dimension,
                chunk_embeddings=[
                    {
                        "document_chunk_id": str(chunk["id"]),
                        "embedding": embedding,
                    }
                    for chunk, embedding in zip(inserted_chunks, embeddings, strict=True)
                ],
            )

        async with async_session_factory() as session:
            service = DocumentIngestionService(session)
            projection_event_id = await service.mark_ingestion_completed(
                workflow_run_id=workflow_run_id,
                document_id=document_id,
                workflow_step_id=workflow_step_id,
                document_version_id=str(context["document_version_id"]),
                parser_name=parsed_document.parser_name,
                chunk_count=len(chunks),
                embedding_model=embedding_provider.model_name,
                embedding_count=len(embeddings),
            )
    except (LookupError, ValueError) as error:
        async with async_session_factory() as session:
            service = DocumentIngestionService(session)
            await service.mark_ingestion_failed(
                workflow_run_id=workflow_run_id,
                document_id=document_id,
                workflow_step_id=workflow_step_id,
                error_message=str(error),
            )
        raise ApplicationError(str(error), non_retryable=True) from error
    except Exception as error:
        async with async_session_factory() as session:
            service = DocumentIngestionService(session)
            await service.mark_ingestion_failed(
                workflow_run_id=workflow_run_id,
                document_id=document_id,
                workflow_step_id=workflow_step_id,
                error_message=str(error),
            )
        raise

    return {
        "document_id": document_id,
        "workflow_run_id": workflow_run_id,
        "workflow_step_id": workflow_step_id or "",
        "projection_event_id": projection_event_id,
        "status": "completed",
    }
