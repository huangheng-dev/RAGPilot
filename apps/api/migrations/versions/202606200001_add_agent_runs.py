"""add agent run history

Revision ID: 202606200001
Revises: 202606190002
Create Date: 2026-06-20 15:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "202606200001"
down_revision: Union[str, None] = "202606190002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agent_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("agent_definition_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("knowledge_base_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("target_surface", sa.String(length=40), nullable=False),
        sa.Column("handoff_intent", sa.String(length=80), nullable=True),
        sa.Column("run_status", sa.String(length=40), server_default=sa.text("'launched'"), nullable=False),
        sa.Column("trigger_source", sa.String(length=80), server_default=sa.text("'agents_console'"), nullable=False),
        sa.Column("launch_prompt", sa.Text(), nullable=True),
        sa.Column("navigation_href", sa.String(length=2000), nullable=True),
        sa.Column("launched_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["agent_definition_id"], ["agent_definitions.id"]),
        sa.ForeignKeyConstraint(["knowledge_base_id"], ["knowledge_bases.id"]),
        sa.ForeignKeyConstraint(["launched_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_agent_runs_tenant_id", "agent_runs", ["tenant_id"])
    op.create_index("ix_agent_runs_agent_definition_id", "agent_runs", ["agent_definition_id"])
    op.create_index("ix_agent_runs_created_at", "agent_runs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_agent_runs_created_at", table_name="agent_runs")
    op.drop_index("ix_agent_runs_agent_definition_id", table_name="agent_runs")
    op.drop_index("ix_agent_runs_tenant_id", table_name="agent_runs")
    op.drop_table("agent_runs")
