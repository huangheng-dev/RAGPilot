"""add workflow run events

Revision ID: 202606300001
Revises: 202606250001
Create Date: 2026-06-30 11:20:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "202606300001"
down_revision: str | None = "202606250001"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "workflow_run_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("workflow_run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("workflow_runs.id"), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("actor_role", sa.String(length=40), nullable=True),
        sa.Column("action_type", sa.String(length=80), nullable=False),
        sa.Column(
            "detail_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(
        "ix_workflow_run_events_workflow_run_id",
        "workflow_run_events",
        ["workflow_run_id"],
    )
    op.create_index(
        "ix_workflow_run_events_created_at",
        "workflow_run_events",
        ["created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_workflow_run_events_created_at", table_name="workflow_run_events")
    op.drop_index("ix_workflow_run_events_workflow_run_id", table_name="workflow_run_events")
    op.drop_table("workflow_run_events")
