"""add agent execution runtime control

Revision ID: 202607110001
Revises: 202606300001
Create Date: 2026-07-11 16:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "202607110001"
down_revision: str | None = "202606300001"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("agent_executions", sa.Column("temporal_workflow_id", sa.String(length=240), nullable=True))
    op.add_column(
        "agent_executions",
        sa.Column("retry_of_execution_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column("agent_executions", sa.Column("cancellation_requested_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("agent_executions", sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        "fk_agent_executions_retry_of_execution_id",
        "agent_executions",
        "agent_executions",
        ["retry_of_execution_id"],
        ["id"],
    )
    op.create_index("ix_agent_executions_temporal_workflow_id", "agent_executions", ["temporal_workflow_id"], unique=True)
    op.create_index("ix_agent_executions_retry_of_execution_id", "agent_executions", ["retry_of_execution_id"])


def downgrade() -> None:
    op.drop_index("ix_agent_executions_retry_of_execution_id", table_name="agent_executions")
    op.drop_index("ix_agent_executions_temporal_workflow_id", table_name="agent_executions")
    op.drop_constraint("fk_agent_executions_retry_of_execution_id", "agent_executions", type_="foreignkey")
    op.drop_column("agent_executions", "cancelled_at")
    op.drop_column("agent_executions", "cancellation_requested_at")
    op.drop_column("agent_executions", "retry_of_execution_id")
    op.drop_column("agent_executions", "temporal_workflow_id")
