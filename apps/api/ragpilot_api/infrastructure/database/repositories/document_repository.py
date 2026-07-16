from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import String, and_, case, delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from ragpilot_api.application.errors import ResourceConflictError
from ragpilot_api.infrastructure.database.models import Document, DocumentAsset, DocumentChunk, DocumentChunkEmbedding, DocumentVersion, MessageCitation, SearchProjectionOutboxEvent, WorkflowRun


class DocumentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_document(
        self,
        *,
        tenant_id: UUID,
        knowledge_base_id: UUID,
        title: str,
        source_uri: str | None,
        data_source_id: UUID | None = None,
    ) -> Document:
        document = Document(
            tenant_id=tenant_id,
            knowledge_base_id=knowledge_base_id,
            title=title,
            source_uri=source_uri,
            data_source_id=data_source_id,
        )
        self.session.add(document)

        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise ResourceConflictError("Document references an unknown tenant or knowledge base.") from error

        await self.session.refresh(document)
        return document

    async def list_documents(
        self,
        *,
        knowledge_base_id: UUID,
        query: str | None = None,
        status_filter: str | None = None,
        source_kind_filter: str | None = None,
        lifecycle_filter: str = "active",
        sort_order: str = "created-desc",
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[Document], int]:
        filters = [Document.knowledge_base_id == knowledge_base_id]
        normalized_lifecycle_filter = lifecycle_filter.strip().lower() if lifecycle_filter else "active"
        if normalized_lifecycle_filter == "deleted":
            filters.append(Document.deleted_at.is_not(None))
        elif normalized_lifecycle_filter != "all":
            filters.append(Document.deleted_at.is_(None))

        normalized_query = query.strip() if query else None
        if normalized_query:
            search_term = f"%{normalized_query.lower()}%"
            filters.append(
                or_(
                    func.lower(Document.title).like(search_term),
                    func.lower(func.coalesce(Document.source_uri, "")).like(search_term),
                )
            )

        normalized_status_filter = status_filter.strip().lower() if status_filter else None
        if normalized_status_filter and normalized_status_filter != "all":
            filters.append(
                or_(
                    Document.ingestion_status == normalized_status_filter,
                    Document.indexing_status == normalized_status_filter,
                )
            )

        normalized_source_kind_filter = source_kind_filter.strip().lower() if source_kind_filter else None
        if normalized_source_kind_filter and normalized_source_kind_filter != "all":
            normalized_source_uri = func.lower(func.coalesce(Document.source_uri, ""))
            if normalized_source_kind_filter == "web":
                filters.append(
                    or_(
                        normalized_source_uri.like("http://%"),
                        normalized_source_uri.like("https://%"),
                    )
                )
            elif normalized_source_kind_filter == "file":
                filters.append(
                    and_(
                        normalized_source_uri != "",
                        ~normalized_source_uri.like("http://%"),
                        ~normalized_source_uri.like("https://%"),
                    )
                )
            elif normalized_source_kind_filter == "other":
                filters.append(normalized_source_uri == "")

        statement = select(Document).where(*filters)
        count_statement = select(func.count()).select_from(Document).where(*filters)
        statement = statement.order_by(*build_document_sort_order(sort_order))
        statement = statement.limit(limit).offset(offset)

        total_count = int((await self.session.scalar(count_statement)) or 0)
        result = await self.session.scalars(statement)
        return list(result), total_count

    async def get_document(
        self,
        *,
        document_id: UUID,
        knowledge_base_id: UUID,
        include_deleted: bool = False,
        only_deleted: bool = False,
    ) -> Document | None:
        filters = [
            Document.id == document_id,
            Document.knowledge_base_id == knowledge_base_id,
        ]
        if only_deleted:
            filters.append(Document.deleted_at.is_not(None))
        elif not include_deleted:
            filters.append(Document.deleted_at.is_(None))

        return await self.session.scalar(select(Document).where(*filters))

    async def get_latest_workflow_runs_for_documents(self, *, document_ids: list[UUID]) -> dict[UUID, dict]:
        if not document_ids:
            return {}

        latest_workflow_subquery = (
            select(
                WorkflowRun.subject_id.label("document_id"),
                WorkflowRun.id.label("workflow_run_id"),
                WorkflowRun.workflow_type.label("workflow_type"),
                WorkflowRun.workflow_status.label("workflow_status"),
                WorkflowRun.error_message.label("error_message"),
                WorkflowRun.updated_at.label("updated_at"),
                func.row_number()
                .over(
                    partition_by=WorkflowRun.subject_id,
                    order_by=(WorkflowRun.created_at.desc(), WorkflowRun.updated_at.desc()),
                )
                .label("workflow_rank"),
            )
            .where(
                WorkflowRun.subject_type == "document",
                WorkflowRun.subject_id.in_(document_ids),
            )
            .subquery()
        )

        latest_workflow_rows = await self.session.execute(
            select(
                latest_workflow_subquery.c.document_id,
                latest_workflow_subquery.c.workflow_run_id,
                latest_workflow_subquery.c.workflow_type,
                latest_workflow_subquery.c.workflow_status,
                latest_workflow_subquery.c.error_message,
                latest_workflow_subquery.c.updated_at,
            ).where(latest_workflow_subquery.c.workflow_rank == 1)
        )

        return {
            row[0]: {
                "latest_workflow_run_id": row[1],
                "latest_workflow_type": row[2],
                "latest_workflow_status": row[3],
                "latest_workflow_error_message": row[4],
                "latest_workflow_updated_at": row[5],
            }
            for row in latest_workflow_rows.all()
        }

    async def get_latest_version_summaries_for_documents(self, *, document_ids: list[UUID]) -> dict[UUID, dict]:
        if not document_ids:
            return {}

        latest_version_subquery = (
            select(
                DocumentVersion.document_id.label("document_id"),
                DocumentVersion.id.label("document_version_id"),
                DocumentVersion.version_number.label("version_number"),
                DocumentVersion.parser_name.label("parser_name"),
                DocumentVersion.ingestion_status.label("ingestion_status"),
                DocumentVersion.updated_at.label("updated_at"),
                func.row_number()
                .over(
                    partition_by=DocumentVersion.document_id,
                    order_by=(DocumentVersion.version_number.desc(), DocumentVersion.updated_at.desc()),
                )
                .label("version_rank"),
            )
            .where(DocumentVersion.document_id.in_(document_ids))
            .subquery()
        )

        latest_version_rows = await self.session.execute(
            select(
                latest_version_subquery.c.document_id,
                latest_version_subquery.c.version_number,
                latest_version_subquery.c.parser_name,
                latest_version_subquery.c.ingestion_status,
                latest_version_subquery.c.updated_at,
                func.count(DocumentChunk.id).label("chunk_count"),
                func.coalesce(func.sum(DocumentChunk.token_count), 0).label("token_count_total"),
            )
            .outerjoin(DocumentChunk, DocumentChunk.document_version_id == latest_version_subquery.c.document_version_id)
            .where(latest_version_subquery.c.version_rank == 1)
            .group_by(
                latest_version_subquery.c.document_id,
                latest_version_subquery.c.version_number,
                latest_version_subquery.c.parser_name,
                latest_version_subquery.c.ingestion_status,
                latest_version_subquery.c.updated_at,
            )
        )

        return {
            row[0]: {
                "latest_version_number": row[1],
                "latest_version_parser_name": row[2],
                "latest_version_ingestion_status": row[3],
                "latest_version_updated_at": row[4],
                "latest_version_chunk_count": int(row[5] or 0),
                "latest_version_token_count_total": int(row[6] or 0),
            }
            for row in latest_version_rows.all()
        }

    async def get_document_metrics(self, *, knowledge_base_id: UUID) -> dict[str, int]:
        row = (
            await self.session.execute(
                select(
                    func.count(Document.id).label("total_documents"),
                    func.coalesce(
                        func.sum(
                            case(
                                (
                                    and_(
                                        Document.ingestion_status == "completed",
                                        Document.indexing_status == "completed",
                                    ),
                                    1,
                                ),
                                else_=0,
                            )
                        ),
                        0,
                    ).label("completed_documents"),
                    func.coalesce(
                        func.sum(
                            case(
                                (
                                    or_(
                                        Document.ingestion_status.in_(("pending", "queued", "running")),
                                        Document.indexing_status.in_(("pending", "queued", "running")),
                                    ),
                                    1,
                                ),
                                else_=0,
                            )
                        ),
                        0,
                    ).label("active_documents"),
                    func.coalesce(
                        func.sum(
                            case(
                                (
                                    or_(
                                        Document.ingestion_status == "failed",
                                        Document.indexing_status == "failed",
                                    ),
                                    1,
                                ),
                                else_=0,
                            )
                        ),
                        0,
                    ).label("failed_documents"),
                ).where(
                    Document.knowledge_base_id == knowledge_base_id,
                    Document.deleted_at.is_(None),
                )
            )
        ).one()

        return {
            "total_documents": int(row.total_documents or 0),
            "completed_documents": int(row.completed_documents or 0),
            "active_documents": int(row.active_documents or 0),
            "failed_documents": int(row.failed_documents or 0),
        }

    async def get_document_detail(
        self,
        *,
        document_id: UUID,
        knowledge_base_id: UUID,
        document_version_id: UUID | None = None,
        include_deleted: bool = False,
    ) -> dict | None:
        latest_completed_version = aliased(DocumentVersion)
        document = await self.get_document(
            document_id=document_id,
            knowledge_base_id=knowledge_base_id,
            include_deleted=include_deleted,
        )
        if document is None:
            return None

        version_row = await self._get_document_version_detail_row(
            document_id=document.id,
            document_version_id=document_version_id,
        )
        if version_row is None:
            return None

        chunks_result = await self.session.scalars(
            select(DocumentChunk)
            .where(DocumentChunk.document_version_id == version_row[0])
            .order_by(DocumentChunk.chunk_index.asc())
        )

        return {
            **(
                await self._build_document_detail_payload(
                    document=document,
                    document_version_id=version_row[0],
                    parser_name=version_row[1],
                    version_number=version_row[2],
                    version_ingestion_status=version_row[3],
                    content_hash=version_row[4],
                    document_asset_id=version_row[5],
                    asset_file_name=version_row[6],
                    asset_content_type=version_row[7],
                    asset_file_size_bytes=version_row[8],
                    storage_bucket=version_row[9],
                    storage_key=version_row[10],
                    chunks=list(chunks_result),
                    latest_completed_version=latest_completed_version,
                )
            )
        }

    async def get_document_activity(
        self,
        *,
        document_id: UUID,
        knowledge_base_id: UUID,
        include_deleted: bool = False,
    ) -> dict | None:
        document = await self.get_document(
            document_id=document_id,
            knowledge_base_id=knowledge_base_id,
            include_deleted=include_deleted,
        )
        if document is None:
            return None

        version_rows = (
            await self.session.execute(
                select(
                    DocumentVersion.id,
                    DocumentVersion.version_number,
                    DocumentVersion.parser_name,
                    DocumentVersion.ingestion_status,
                    DocumentVersion.created_at,
                    func.count(DocumentChunk.id).label("chunk_count"),
                    func.coalesce(func.sum(DocumentChunk.token_count), 0).label("token_count_total"),
                    func.max(DocumentAsset.file_name).label("asset_file_name"),
                )
                .outerjoin(DocumentChunk, DocumentChunk.document_version_id == DocumentVersion.id)
                .outerjoin(DocumentAsset, DocumentAsset.document_version_id == DocumentVersion.id)
                .where(DocumentVersion.document_id == document.id)
                .group_by(DocumentVersion.id)
                .order_by(DocumentVersion.version_number.desc(), DocumentVersion.created_at.desc())
            )
        ).all()

        workflow_rows = (
            await self.session.execute(
                select(
                    WorkflowRun.id,
                    WorkflowRun.workflow_type,
                    WorkflowRun.workflow_status,
                    WorkflowRun.error_message,
                    WorkflowRun.started_at,
                    WorkflowRun.completed_at,
                    WorkflowRun.created_at,
                    WorkflowRun.updated_at,
                    WorkflowRun.input_json,
                )
                .where(
                    WorkflowRun.subject_type == "document",
                    WorkflowRun.subject_id == document.id,
                )
                .order_by(WorkflowRun.created_at.desc(), WorkflowRun.updated_at.desc())
            )
        ).all()

        events: list[dict[str, Any]] = [
            {
                "id": f"document-registered-{document.id}",
                "event_type": "document_registered",
                "status": "completed",
                "timestamp": document.created_at,
                "workflow_run_id": None,
                "retry_of_workflow_run_id": None,
                "document_version_id": None,
                "version_number": None,
                "parser_name": None,
                "chunk_count": None,
                "token_count_total": None,
                "error_message": None,
            }
        ]

        latest_asset_file_name = None
        for version_row in version_rows:
            latest_asset_file_name = latest_asset_file_name or version_row.asset_file_name
            events.append(
                {
                    "id": f"document-version-{version_row.id}",
                    "event_type": "document_version_created",
                    "status": version_row.ingestion_status,
                    "timestamp": version_row.created_at,
                    "workflow_run_id": None,
                    "retry_of_workflow_run_id": None,
                    "document_version_id": version_row.id,
                    "version_number": version_row.version_number,
                    "parser_name": version_row.parser_name,
                    "chunk_count": int(version_row.chunk_count or 0),
                    "token_count_total": int(version_row.token_count_total or 0),
                    "error_message": None,
                }
            )

        for workflow_row in workflow_rows:
            input_json = workflow_row.input_json or {}
            retry_of_workflow_run_id = input_json.get("retry_of_workflow_run_id")

            events.append(
                {
                    "id": f"workflow-created-{workflow_row.id}",
                    "event_type": "workflow_retry_requested" if retry_of_workflow_run_id else "workflow_started",
                    "status": workflow_row.workflow_status,
                    "timestamp": workflow_row.created_at,
                    "workflow_run_id": workflow_row.id,
                    "retry_of_workflow_run_id": retry_of_workflow_run_id,
                    "document_version_id": None,
                    "version_number": None,
                    "parser_name": None,
                    "chunk_count": None,
                    "token_count_total": None,
                    "error_message": workflow_row.error_message,
                }
            )

            if workflow_row.started_at:
                events.append(
                    {
                        "id": f"workflow-executing-{workflow_row.id}",
                        "event_type": "workflow_execution_started",
                        "status": "running" if workflow_row.workflow_status != "failed" else workflow_row.workflow_status,
                        "timestamp": workflow_row.started_at,
                        "workflow_run_id": workflow_row.id,
                        "retry_of_workflow_run_id": retry_of_workflow_run_id,
                        "document_version_id": None,
                        "version_number": None,
                        "parser_name": None,
                        "chunk_count": None,
                        "token_count_total": None,
                        "error_message": workflow_row.error_message,
                    }
                )

            if workflow_row.completed_at:
                if workflow_row.workflow_status == "failed":
                    terminal_event_type = "workflow_failed"
                elif workflow_row.workflow_status == "cancelled":
                    terminal_event_type = "workflow_cancelled"
                else:
                    terminal_event_type = "workflow_completed"
                events.append(
                    {
                        "id": f"workflow-terminal-{workflow_row.id}",
                        "event_type": terminal_event_type,
                        "status": workflow_row.workflow_status,
                        "timestamp": workflow_row.completed_at,
                        "workflow_run_id": workflow_row.id,
                        "retry_of_workflow_run_id": retry_of_workflow_run_id,
                        "document_version_id": None,
                        "version_number": None,
                        "parser_name": None,
                        "chunk_count": None,
                        "token_count_total": None,
                        "error_message": workflow_row.error_message,
                    }
                )

        events.sort(key=lambda event: event["timestamp"], reverse=True)
        latest_event_at = events[0]["timestamp"] if events else None
        failed_events = sum(1 for event in events if event["status"] == "failed")
        retry_runs = sum(1 for workflow_row in workflow_rows if (workflow_row.input_json or {}).get("retry_of_workflow_run_id"))

        return {
            "document_id": document.id,
            "title": document.title,
            "asset_file_name": latest_asset_file_name,
            "summary": {
                "total_events": len(events),
                "total_versions": len(version_rows),
                "workflow_runs": len(workflow_rows),
                "retry_runs": retry_runs,
                "failed_events": failed_events,
                "latest_event_at": latest_event_at,
            },
            "events": events,
        }

    async def _get_document_version_detail_row(
        self,
        *,
        document_id: UUID,
        document_version_id: UUID | None,
    ):
        version_model = aliased(DocumentVersion)
        asset_model = aliased(DocumentAsset)

        statement = (
            select(
                version_model.id,
                version_model.parser_name,
                version_model.version_number,
                version_model.ingestion_status,
                version_model.content_hash,
                asset_model.id,
                asset_model.file_name,
                asset_model.content_type,
                asset_model.file_size_bytes,
                asset_model.storage_bucket,
                asset_model.storage_key,
            )
            .outerjoin(asset_model, asset_model.document_version_id == version_model.id)
            .where(version_model.document_id == document_id)
        )

        if document_version_id is not None:
            statement = statement.where(version_model.id == document_version_id)
        else:
            statement = statement.order_by(version_model.version_number.desc().nullslast()).limit(1)

        result = await self.session.execute(statement)
        return result.first()

    async def _build_document_detail_payload(
        self,
        *,
        document: Document,
        document_version_id: UUID | None,
        parser_name: str | None,
        version_number: int | None,
        version_ingestion_status: str | None,
        content_hash: str | None,
        document_asset_id: UUID | None,
        asset_file_name: str | None,
        asset_content_type: str | None,
        asset_file_size_bytes: int | None,
        storage_bucket: str | None,
        storage_key: str | None,
        chunks: list[DocumentChunk],
        latest_completed_version: DocumentVersion,
    ) -> dict:
        latest_completed_result = await self.session.execute(
            select(
                latest_completed_version.id,
                latest_completed_version.version_number,
                latest_completed_version.ingestion_status,
                latest_completed_version.parser_name,
            )
            .where(
                latest_completed_version.document_id == document.id,
                latest_completed_version.ingestion_status == "completed",
            )
            .order_by(latest_completed_version.version_number.desc())
            .limit(1)
        )
        latest_completed_row = latest_completed_result.first()

        recent_versions_result = await self.session.execute(
            select(
                DocumentVersion.id,
                DocumentVersion.version_number,
                DocumentVersion.ingestion_status,
                DocumentVersion.parser_name,
                DocumentVersion.created_at,
                DocumentVersion.updated_at,
                func.count(DocumentChunk.id).label("chunk_count"),
                func.coalesce(func.sum(DocumentChunk.token_count), 0).label("token_count_total"),
            )
            .outerjoin(DocumentChunk, DocumentChunk.document_version_id == DocumentVersion.id)
            .where(DocumentVersion.document_id == document.id)
            .group_by(DocumentVersion.id)
            .order_by(DocumentVersion.version_number.desc())
            .limit(5)
        )
        token_count_total = sum(chunk.token_count or 0 for chunk in chunks)

        return {
            "document": document,
            "document_version_id": document_version_id,
            "parser_name": parser_name,
            "version_number": version_number,
            "version_ingestion_status": version_ingestion_status,
            "content_hash": content_hash,
            "document_asset_id": document_asset_id,
            "asset_file_name": asset_file_name,
            "asset_content_type": asset_content_type,
            "asset_file_size_bytes": asset_file_size_bytes,
            "storage_bucket": storage_bucket,
            "storage_key": storage_key,
            "latest_completed_version_id": latest_completed_row[0] if latest_completed_row else None,
            "latest_completed_version_number": latest_completed_row[1] if latest_completed_row else None,
            "latest_completed_version_ingestion_status": latest_completed_row[2] if latest_completed_row else None,
            "latest_completed_parser_name": latest_completed_row[3] if latest_completed_row else None,
            "chunk_count": len(chunks),
            "token_count_total": token_count_total,
            "recent_versions": [
                {
                    "id": version_row[0],
                    "version_number": version_row[1],
                    "ingestion_status": version_row[2],
                    "parser_name": version_row[3],
                    "created_at": version_row[4],
                    "updated_at": version_row[5],
                    "chunk_count": int(version_row[6] or 0),
                    "token_count_total": int(version_row[7] or 0),
                }
                for version_row in recent_versions_result.all()
            ],
            "chunks": chunks,
        }

    async def create_uploaded_document(
        self,
        *,
        tenant_id: UUID,
        knowledge_base_id: UUID,
        title: str,
        source_uri: str,
        content_hash: str,
        storage_bucket: str,
        storage_key: str,
        file_name: str,
        content_type: str | None,
        file_size_bytes: int,
        data_source_id: UUID | None = None,
    ) -> tuple[Document, DocumentVersion, DocumentAsset, WorkflowRun]:
        document = Document(
            tenant_id=tenant_id,
            knowledge_base_id=knowledge_base_id,
            title=title,
            source_uri=source_uri,
            data_source_id=data_source_id,
        )
        self.session.add(document)

        try:
            await self.session.flush()

            document_version = DocumentVersion(
                tenant_id=tenant_id,
                document_id=document.id,
                version_number=1,
                content_hash=content_hash,
            )
            self.session.add(document_version)
            await self.session.flush()

            document_asset = DocumentAsset(
                tenant_id=tenant_id,
                document_version_id=document_version.id,
                storage_bucket=storage_bucket,
                storage_key=storage_key,
                file_name=file_name,
                content_type=content_type,
                file_size_bytes=file_size_bytes,
            )
            self.session.add(document_asset)
            await self.session.flush()

            workflow_run = WorkflowRun(
                tenant_id=tenant_id,
                workflow_type="document_ingestion",
                workflow_status="pending",
                subject_type="document",
                subject_id=document.id,
                input_json={
                    "tenant_id": str(tenant_id),
                    "document_id": str(document.id),
                    "document_version_id": str(document_version.id),
                    "document_asset_id": str(document_asset.id),
                    "storage_bucket": storage_bucket,
                    "storage_key": storage_key,
                },
            )
            self.session.add(workflow_run)
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise ResourceConflictError("Uploaded document references an unknown tenant or knowledge base.") from error

        await self.session.refresh(document)
        await self.session.refresh(document_version)
        await self.session.refresh(document_asset)
        await self.session.refresh(workflow_run)
        return document, document_version, document_asset, workflow_run

    async def create_reindex_workflow_run(
        self,
        *,
        document_id: UUID,
        knowledge_base_id: UUID,
        retry_of_workflow_run_id: UUID | None = None,
    ) -> tuple[Document, DocumentVersion, WorkflowRun] | None:
        detail = await self.get_document_detail(document_id=document_id, knowledge_base_id=knowledge_base_id)
        if detail is None or detail["version_number"] is None or detail["storage_key"] is None:
            return None

        document = detail["document"]

        try:
            document.ingestion_status = "pending"
            document.indexing_status = "pending"

            next_version_number = int(detail["version_number"]) + 1
            document_version = DocumentVersion(
                tenant_id=document.tenant_id,
                document_id=document.id,
                version_number=next_version_number,
                content_hash=detail["content_hash"],
            )
            self.session.add(document_version)
            await self.session.flush()

            document_asset = DocumentAsset(
                tenant_id=document.tenant_id,
                document_version_id=document_version.id,
                storage_bucket=detail["storage_bucket"],
                storage_key=detail["storage_key"],
                file_name=detail["asset_file_name"],
                content_type=detail["asset_content_type"],
                file_size_bytes=detail["asset_file_size_bytes"],
            )
            self.session.add(document_asset)
            await self.session.flush()

            workflow_run = WorkflowRun(
                tenant_id=document.tenant_id,
                workflow_type="document_ingestion",
                workflow_status="pending",
                subject_type="document",
                subject_id=document.id,
                input_json={
                    "tenant_id": str(document.tenant_id),
                    "document_id": str(document.id),
                    "document_version_id": str(document_version.id),
                    "document_asset_id": str(document_asset.id),
                    "storage_bucket": detail["storage_bucket"],
                    "storage_key": detail["storage_key"],
                    "reindex_requested": True,
                    "source_document_version_id": str(detail["document_version_id"]),
                    "retry_of_workflow_run_id": str(retry_of_workflow_run_id) if retry_of_workflow_run_id else None,
                },
            )
            self.session.add(workflow_run)
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise ResourceConflictError("Unable to prepare document reindex workflow.") from error

        await self.session.refresh(document)
        await self.session.refresh(document_version)
        await self.session.refresh(workflow_run)
        return document, document_version, workflow_run

    async def soft_delete_document(
        self,
        *,
        document_id: UUID,
        knowledge_base_id: UUID,
    ) -> tuple[UUID, datetime, UUID] | None:
        document = await self.get_document(document_id=document_id, knowledge_base_id=knowledge_base_id)
        if document is None:
            return None

        deleted_at = datetime.now(timezone.utc)
        document.deleted_at = deleted_at
        document.updated_at = deleted_at
        projection_event = SearchProjectionOutboxEvent(
            tenant_id=document.tenant_id,
            aggregate_type="document",
            aggregate_id=document.id,
            document_id=document.id,
            document_version_id=None,
            event_type="document_delete",
            event_key=f"document:{document.id}:soft-delete:{deleted_at.isoformat()}",
            payload_json={"reason": "soft_delete", "deleted_at": deleted_at.isoformat()},
        )
        self.session.add(projection_event)
        await self.session.flush()
        await self.session.commit()
        return document.id, deleted_at, projection_event.id

    async def restore_document(
        self,
        *,
        document_id: UUID,
        knowledge_base_id: UUID,
    ) -> tuple[Document, UUID | None] | None:
        document = await self.get_document(
            document_id=document_id,
            knowledge_base_id=knowledge_base_id,
            include_deleted=True,
            only_deleted=True,
        )
        if document is None:
            return None

        restored_at = datetime.now(timezone.utc)
        document.deleted_at = None
        document.updated_at = restored_at
        latest_completed_version = await self.session.scalar(
            select(DocumentVersion)
            .where(
                DocumentVersion.document_id == document.id,
                DocumentVersion.tenant_id == document.tenant_id,
                DocumentVersion.ingestion_status == "completed",
            )
            .order_by(DocumentVersion.version_number.desc(), DocumentVersion.created_at.desc())
            .limit(1)
        )
        projection_event: SearchProjectionOutboxEvent | None = None
        if latest_completed_version is not None:
            projection_event = SearchProjectionOutboxEvent(
                tenant_id=document.tenant_id,
                aggregate_type="document_version",
                aggregate_id=latest_completed_version.id,
                document_id=document.id,
                document_version_id=latest_completed_version.id,
                event_type="document_version_upsert",
                event_key=f"document:{document.id}:restore:{restored_at.isoformat()}",
                payload_json={
                    "reason": "restore",
                    "restored_at": restored_at.isoformat(),
                    "document_version_id": str(latest_completed_version.id),
                },
            )
            self.session.add(projection_event)
            await self.session.flush()
        await self.session.commit()
        await self.session.refresh(document)
        return document, projection_event.id if projection_event is not None else None

    async def get_permanent_delete_candidate(self, *, document_id: UUID, knowledge_base_id: UUID) -> dict | None:
        document = await self.get_document(document_id=document_id, knowledge_base_id=knowledge_base_id, include_deleted=True, only_deleted=True)
        if document is None:
            return None
        version_ids = select(DocumentVersion.id).where(DocumentVersion.document_id == document.id)
        chunk_ids = select(DocumentChunk.id).where(DocumentChunk.document_version_id.in_(version_ids))
        citation_count = int((await self.session.scalar(select(func.count()).select_from(MessageCitation).where(MessageCitation.document_chunk_id.in_(chunk_ids)))) or 0)
        assets = (await self.session.execute(select(DocumentAsset.storage_bucket, DocumentAsset.storage_key).where(DocumentAsset.document_version_id.in_(version_ids)))).all()
        return {"document": document, "assets": [(row[0], row[1]) for row in assets], "citation_count": citation_count}

    async def permanently_delete_document(self, *, document_id: UUID) -> UUID:
        document = await self.session.scalar(select(Document).where(Document.id == document_id))
        if document is None:
            raise ResourceConflictError("Document disappeared before permanent deletion could complete.")
        deleted_at = datetime.now(timezone.utc)
        projection_event = SearchProjectionOutboxEvent(
            tenant_id=document.tenant_id,
            aggregate_type="document",
            aggregate_id=document.id,
            document_id=document.id,
            document_version_id=None,
            event_type="document_delete",
            event_key=f"document:{document.id}:purge:{deleted_at.isoformat()}",
            payload_json={"reason": "permanent_delete", "deleted_at": deleted_at.isoformat()},
        )
        self.session.add(projection_event)
        await self.session.flush()
        version_ids = select(DocumentVersion.id).where(DocumentVersion.document_id == document_id)
        chunk_ids = select(DocumentChunk.id).where(DocumentChunk.document_version_id.in_(version_ids))
        await self.session.execute(delete(DocumentChunkEmbedding).where(DocumentChunkEmbedding.document_chunk_id.in_(chunk_ids)))
        await self.session.execute(delete(DocumentChunk).where(DocumentChunk.document_version_id.in_(version_ids)))
        await self.session.execute(delete(DocumentAsset).where(DocumentAsset.document_version_id.in_(version_ids)))
        await self.session.execute(delete(DocumentVersion).where(DocumentVersion.document_id == document_id))
        await self.session.execute(delete(Document).where(Document.id == document_id))
        await self.session.commit()
        return projection_event.id


def build_document_sort_order(sort_order: str) -> tuple:
    if sort_order == "updated-desc":
        return (Document.updated_at.desc(), Document.created_at.desc())
    if sort_order == "created-asc":
        return (Document.created_at.asc(), Document.updated_at.asc())
    if sort_order == "title-asc":
        return (func.lower(Document.title).asc(), Document.created_at.desc())
    if sort_order == "title-desc":
        return (func.lower(Document.title).desc(), Document.created_at.desc())
    if sort_order == "status-priority":
        status_rank = case(
            (Document.ingestion_status == "failed", 0),
            (Document.indexing_status == "failed", 0),
            (Document.ingestion_status == "running", 1),
            (Document.indexing_status == "running", 1),
            (Document.ingestion_status == "queued", 2),
            (Document.indexing_status == "queued", 2),
            (Document.ingestion_status == "pending", 3),
            (Document.indexing_status == "pending", 3),
            else_=4,
        )
        return (status_rank.asc(), Document.updated_at.desc())
    return (Document.created_at.desc(), Document.updated_at.desc())
