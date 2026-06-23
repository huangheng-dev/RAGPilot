from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import String, and_, case, func, or_, select, cast
from sqlalchemy.ext.asyncio import AsyncSession

from ragpilot_api.infrastructure.database.models import Document, WorkflowRun, WorkflowStep


class WorkflowRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_workflow_run(
        self,
        *,
        tenant_id: UUID,
        workflow_type: str,
        subject_type: str,
        subject_id: UUID,
        input_json: dict[str, Any],
    ) -> WorkflowRun:
        workflow_run = WorkflowRun(
            tenant_id=tenant_id,
            workflow_type=workflow_type,
            workflow_status="pending",
            subject_type=subject_type,
            subject_id=subject_id,
            input_json=input_json,
        )
        self.session.add(workflow_run)
        await self.session.flush()
        return workflow_run

    async def list_workflow_runs(
        self,
        *,
        tenant_id: UUID,
        query: str | None = None,
        status_filter: str | None = None,
        workflow_type: str | None = None,
        retry_mode: str | None = None,
        subject_id: UUID | None = None,
        sort_order: str = "created-desc",
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[WorkflowRun], int]:
        filters = [WorkflowRun.tenant_id == tenant_id]
        document_join_condition = and_(
            WorkflowRun.subject_type == "document",
            WorkflowRun.subject_id == Document.id,
        )
        normalized_query = query.strip() if query else None
        if normalized_query:
            search_term = f"%{normalized_query.lower()}%"
            filters.append(
                or_(
                    func.lower(cast(WorkflowRun.id, String)).like(search_term),
                    func.lower(WorkflowRun.workflow_type).like(search_term),
                    func.lower(func.coalesce(WorkflowRun.subject_type, "")).like(search_term),
                    func.lower(func.coalesce(cast(WorkflowRun.subject_id, String), "")).like(search_term),
                    func.lower(func.coalesce(Document.title, "")).like(search_term),
                    func.lower(func.coalesce(WorkflowRun.error_message, "")).like(search_term),
                )
            )

        normalized_status_filter = status_filter.strip().lower() if status_filter else None
        if normalized_status_filter and normalized_status_filter != "all":
            filters.append(WorkflowRun.workflow_status == normalized_status_filter)

        normalized_workflow_type = workflow_type.strip().lower() if workflow_type else None
        if normalized_workflow_type and normalized_workflow_type != "all":
            filters.append(func.lower(WorkflowRun.workflow_type) == normalized_workflow_type)

        normalized_retry_mode = retry_mode.strip().lower() if retry_mode else None
        if normalized_retry_mode == "retries":
            filters.append(
                func.coalesce(cast(WorkflowRun.input_json["retry_of_workflow_run_id"].as_string(), String), "") != ""
            )
        elif normalized_retry_mode == "originals":
            filters.append(
                func.coalesce(cast(WorkflowRun.input_json["retry_of_workflow_run_id"].as_string(), String), "") == ""
            )

        if subject_id is not None:
            filters.append(WorkflowRun.subject_id == subject_id)

        statement = select(WorkflowRun).outerjoin(Document, document_join_condition).where(*filters)
        count_statement = select(func.count()).select_from(WorkflowRun).outerjoin(Document, document_join_condition).where(*filters)
        statement = statement.order_by(*build_workflow_sort_order(sort_order))
        statement = statement.limit(limit).offset(offset)

        total_count = int((await self.session.scalar(count_statement)) or 0)
        result = await self.session.scalars(statement)
        return list(result), total_count

    async def get_workflow_run(self, *, workflow_run_id: UUID, tenant_id: UUID) -> WorkflowRun | None:
        return await self.session.scalar(
            select(WorkflowRun).where(
                WorkflowRun.id == workflow_run_id,
                WorkflowRun.tenant_id == tenant_id,
            )
        )

    async def get_workflow_metrics(self, *, tenant_id: UUID) -> dict[str, int]:
        row = (
            await self.session.execute(
                select(
                    func.count(WorkflowRun.id).label("total_runs"),
                    func.coalesce(
                        func.sum(
                            case(
                                (WorkflowRun.workflow_status.in_(("pending", "queued", "running")), 1),
                                else_=0,
                            )
                        ),
                        0,
                    ).label("active_runs"),
                    func.coalesce(
                        func.sum(
                            case(
                                (WorkflowRun.workflow_status == "queued", 1),
                                else_=0,
                            )
                        ),
                        0,
                    ).label("queued_runs"),
                    func.coalesce(
                        func.sum(
                            case(
                                (WorkflowRun.workflow_status == "running", 1),
                                else_=0,
                            )
                        ),
                        0,
                    ).label("running_runs"),
                    func.coalesce(
                        func.sum(
                            case(
                                (
                                    func.coalesce(
                                        cast(WorkflowRun.input_json["retry_of_workflow_run_id"].as_string(), String),
                                        "",
                                    )
                                    != "",
                                    1,
                                ),
                                else_=0,
                            )
                        ),
                        0,
                    ).label("retry_runs"),
                    func.coalesce(
                        func.sum(
                            case(
                                (WorkflowRun.workflow_status == "completed", 1),
                                else_=0,
                            )
                        ),
                        0,
                    ).label("completed_runs"),
                    func.coalesce(
                        func.sum(
                            case(
                                (WorkflowRun.workflow_status == "failed", 1),
                                else_=0,
                            )
                        ),
                        0,
                    ).label("failed_runs"),
                ).where(WorkflowRun.tenant_id == tenant_id)
            )
        ).one()

        return {
            "total_runs": int(row.total_runs or 0),
            "active_runs": int(row.active_runs or 0),
            "queued_runs": int(row.queued_runs or 0),
            "running_runs": int(row.running_runs or 0),
            "retry_runs": int(row.retry_runs or 0),
            "completed_runs": int(row.completed_runs or 0),
            "failed_runs": int(row.failed_runs or 0),
        }

    async def list_workflow_steps(self, *, workflow_run_id: UUID) -> list[WorkflowStep]:
        result = await self.session.scalars(
            select(WorkflowStep)
            .where(WorkflowStep.workflow_run_id == workflow_run_id)
            .order_by(WorkflowStep.created_at.asc(), WorkflowStep.step_name.asc())
        )
        return list(result)

    async def create_retry_workflow_run(
        self,
        *,
        workflow_run: WorkflowRun,
    ) -> WorkflowRun:
        retry_workflow_run = WorkflowRun(
            tenant_id=workflow_run.tenant_id,
            workflow_type=workflow_run.workflow_type,
            workflow_status="pending",
            subject_type=workflow_run.subject_type,
            subject_id=workflow_run.subject_id,
            input_json=workflow_run.input_json,
        )
        self.session.add(retry_workflow_run)
        await self.session.commit()
        await self.session.refresh(retry_workflow_run)
        return retry_workflow_run

    async def mark_workflow_run_queued(
        self,
        *,
        workflow_run: WorkflowRun,
        temporal_workflow_id: str,
    ) -> WorkflowRun:
        workflow_run.workflow_status = "queued"
        workflow_run.temporal_workflow_id = temporal_workflow_id
        workflow_run.started_at = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(workflow_run)
        return workflow_run

    async def mark_workflow_run_failed(
        self,
        *,
        workflow_run: WorkflowRun,
        error_message: str,
    ) -> WorkflowRun:
        workflow_run.workflow_status = "failed"
        workflow_run.error_message = error_message
        workflow_run.completed_at = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(workflow_run)
        return workflow_run


def build_workflow_sort_order(sort_order: str) -> tuple:
    if sort_order == "updated-desc":
        return (WorkflowRun.updated_at.desc(), WorkflowRun.created_at.desc())
    if sort_order == "created-asc":
        return (WorkflowRun.created_at.asc(), WorkflowRun.updated_at.asc())
    if sort_order == "status-priority":
        status_rank = case(
            (WorkflowRun.workflow_status == "failed", 0),
            (WorkflowRun.workflow_status == "running", 1),
            (WorkflowRun.workflow_status == "queued", 2),
            (WorkflowRun.workflow_status == "pending", 3),
            else_=4,
        )
        return (status_rank.asc(), WorkflowRun.updated_at.desc())
    if sort_order == "type-asc":
        return (func.lower(WorkflowRun.workflow_type).asc(), WorkflowRun.updated_at.desc())
    return (WorkflowRun.created_at.desc(), WorkflowRun.updated_at.desc())
