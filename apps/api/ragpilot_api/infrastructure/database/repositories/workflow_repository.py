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

    async def get_workflow_run_by_id(self, *, workflow_run_id: UUID) -> WorkflowRun | None:
        return await self.session.scalar(select(WorkflowRun).where(WorkflowRun.id == workflow_run_id))

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
                    func.coalesce(
                        func.sum(
                            case(
                                (WorkflowRun.workflow_status == "cancelled", 1),
                                else_=0,
                            )
                        ),
                        0,
                    ).label("cancelled_runs"),
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
            "cancelled_runs": int(row.cancelled_runs or 0),
        }

    async def list_workflow_steps(
        self,
        *,
        workflow_run_id: UUID,
        status_filter: str | None = None,
        min_attempt_count: int | None = None,
        limit: int | None = None,
    ) -> list[WorkflowStep]:
        statement = select(WorkflowStep).where(WorkflowStep.workflow_run_id == workflow_run_id)
        normalized_status_filter = status_filter.strip().lower() if status_filter else None
        if normalized_status_filter and normalized_status_filter != "all":
            statement = statement.where(WorkflowStep.step_status == normalized_status_filter)
        if min_attempt_count is not None:
            statement = statement.where(WorkflowStep.attempt_count >= min_attempt_count)
        statement = statement.order_by(WorkflowStep.updated_at.desc(), WorkflowStep.created_at.desc(), WorkflowStep.step_name.asc())
        if limit is not None:
            statement = statement.limit(limit)

        result = await self.session.scalars(statement)
        return list(result)

    async def get_workflow_step_summary(self, *, workflow_run_id: UUID) -> dict[str, object]:
        row = (
            await self.session.execute(
                select(
                    func.count(WorkflowStep.id).label("total_step_count"),
                    func.coalesce(func.sum(case((WorkflowStep.step_status == "completed", 1), else_=0)), 0).label(
                        "completed_step_count"
                    ),
                    func.coalesce(func.sum(case((WorkflowStep.step_status == "failed", 1), else_=0)), 0).label(
                        "failed_step_count"
                    ),
                    func.coalesce(
                        func.sum(case((WorkflowStep.step_status.in_(("running", "queued")), 1), else_=0)),
                        0,
                    ).label("active_step_count"),
                    func.coalesce(func.sum(case((WorkflowStep.step_status == "pending", 1), else_=0)), 0).label(
                        "pending_step_count"
                    ),
                ).where(WorkflowStep.workflow_run_id == workflow_run_id)
            )
        ).one()

        latest_failed_step = (
            await self.session.execute(
                select(WorkflowStep.step_name, WorkflowStep.error_message)
                .where(
                    WorkflowStep.workflow_run_id == workflow_run_id,
                    WorkflowStep.step_status == "failed",
                )
                .order_by(WorkflowStep.updated_at.desc(), WorkflowStep.created_at.desc())
                .limit(1)
            )
        ).first()

        latest_active_step = (
            await self.session.execute(
                select(WorkflowStep.step_name, WorkflowStep.started_at)
                .where(
                    WorkflowStep.workflow_run_id == workflow_run_id,
                    WorkflowStep.step_status.in_(("running", "queued")),
                )
                .order_by(WorkflowStep.updated_at.desc(), WorkflowStep.created_at.desc())
                .limit(1)
            )
        ).first()

        latest_completed_step = (
            await self.session.execute(
                select(WorkflowStep.step_name, WorkflowStep.completed_at)
                .where(
                    WorkflowStep.workflow_run_id == workflow_run_id,
                    WorkflowStep.step_status == "completed",
                )
                .order_by(WorkflowStep.completed_at.desc(), WorkflowStep.updated_at.desc(), WorkflowStep.created_at.desc())
                .limit(1)
            )
        ).first()

        highest_attempt_step = (
            await self.session.execute(
                select(WorkflowStep.step_name, WorkflowStep.attempt_count)
                .where(WorkflowStep.workflow_run_id == workflow_run_id)
                .order_by(WorkflowStep.attempt_count.desc(), WorkflowStep.updated_at.desc(), WorkflowStep.created_at.desc())
                .limit(1)
            )
        ).first()

        return {
            "total_step_count": int(row.total_step_count or 0),
            "completed_step_count": int(row.completed_step_count or 0),
            "failed_step_count": int(row.failed_step_count or 0),
            "active_step_count": int(row.active_step_count or 0),
            "pending_step_count": int(row.pending_step_count or 0),
            "latest_active_step_name": latest_active_step[0] if latest_active_step is not None else None,
            "latest_active_step_started_at": latest_active_step[1] if latest_active_step is not None else None,
            "latest_completed_step_name": latest_completed_step[0] if latest_completed_step is not None else None,
            "latest_completed_step_completed_at": latest_completed_step[1] if latest_completed_step is not None else None,
            "highest_attempt_step_name": highest_attempt_step[0] if highest_attempt_step is not None else None,
            "highest_attempt_count": int(highest_attempt_step[1] or 0) if highest_attempt_step is not None else 0,
            "latest_failed_step_name": latest_failed_step[0] if latest_failed_step is not None else None,
            "latest_failed_step_error_message": latest_failed_step[1] if latest_failed_step is not None else None,
        }

    async def get_child_retry_summary(self, *, workflow_run_id: UUID) -> dict[str, object]:
        retry_parent_id = str(workflow_run_id)
        child_retry_runs = list(
            await self.session.scalars(
                select(WorkflowRun)
                .where(cast(WorkflowRun.input_json["retry_of_workflow_run_id"].as_string(), String) == retry_parent_id)
                .order_by(WorkflowRun.created_at.desc(), WorkflowRun.updated_at.desc())
            )
        )
        return {
            "child_retry_run_count": len(child_retry_runs),
            "latest_child_retry_run_id": child_retry_runs[0].id if child_retry_runs else None,
            "latest_child_retry_status": child_retry_runs[0].workflow_status if child_retry_runs else None,
            "active_child_retry_run_id": next(
                (
                    retry_run.id
                    for retry_run in child_retry_runs
                    if retry_run.workflow_status in {"pending", "queued", "running"}
                ),
                None,
            ),
        }

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

    async def mark_workflow_run_cancelled(
        self,
        *,
        workflow_run: WorkflowRun,
        reason: str,
    ) -> WorkflowRun:
        workflow_run.workflow_status = "cancelled"
        workflow_run.error_message = reason
        workflow_run.completed_at = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(workflow_run)
        return workflow_run

    async def update_workflow_run_operator_notes(
        self,
        *,
        workflow_run: WorkflowRun,
        operator_notes: str | None,
    ) -> WorkflowRun:
        workflow_run.operator_notes = operator_notes
        workflow_run.updated_at = datetime.now(timezone.utc)
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
